const EventEmitter = require('events');

const request = ({ err = 'error', value = 'success', timeout = 3000 }) =>
    new Promise((resolve, reject) => {
        setTimeout(() => {
            if (err) {
                reject(err);
            }
            resolve(value);
        }, timeout);
    })
// .then((value) => {
//     console.log(value + ':' + getTime());
// }).catch((err) => {
//     console.log(err + ':' + getTime());
// })

const log = {
    info: (message) => {
        console.log(message);
    },
    success: (message = '') => {
        console.log(message);
    },
    error: (message = '') => {
        console.error(message);
    }
}

class Queue extends EventEmitter {
    constructor({ concurrency = 2, name = 'queue' }) {
        super();
        this.name = name;
        this._queue = [];
        // 队列状态
        this._status = true;
        this._concurrency = concurrency;
        this._running = [...Array(this._concurrency)]
            .map(() => ({ status: 0, taskName: '未知' }));
    }

    /**
     * add task to the queue
     * 
     * @param {Object} taskObj task对象
     * @param {string} taskObj.name 任务名称
     * @param {Function():Promise} taskObj.task 任务执行的方法
     */
    enqueue({ name, task }) {
        if (!this._status) {
            log.error('队列已经终止，请重新创建队列');
            return;
        }
        // 推入总队列中
        this._queue.push({ name, task });
        log.success(`任务：${name} 被推入待执行任务队列中`);
        // 寻找是否有空闲进程
        const thread = this._running.find(({ status }) => status === 0)
        if (thread) {
            this.exec(thread);
        }
    }

    /**
     * remove task from the queue and return this task
     * 
     * @return {Function} 即将执行的任务
     */
    dequeue() {
        return this._queue.shift();
    }

    /**
     * judge whether the queue is empty
     * 
     * @return {boolean} 队列是否为空
     */
    isEmpty() {
        return this._queue.length === 0;
    }

    /**
     * 判断队列是否可用
     * 
     * @returns {boolean} 队列是否可用
     */
    disabled() {
        return this._status;
    }

    /**
     * 执行任务，当前任务执行完成后，递归调用持续执行
     * 
     * @param {Object} thread 线程
     * @param {number} thread.status 线程状态 0:'空闲'  1:'阻塞'
     */
    async exec(thread) {
        if (!this._status) {
            log.error('队列已经终止，请重新创建队列');
            return;
        }
        // 出列 准备执行
        const { name: taskName, task } = this.dequeue();
        log.success(`任务：${taskName} 开始执行`);
        thread.status = 1;

        // 执行任务
        try {
            const startTime = Date.now();
            await task();
            log.success(`任务: ${taskName} 执行完成。耗时：${(Date.now() - startTime) / 1000}s`);
        } catch (err) {
            log.error(`任务: ${taskName} 执行失败，errMsg: ${err}`);

            this.emit('taskError', taskName);
        }

        // 重置线程状态 如果队列中还有任务 继续执行
        thread.status = 0;
        if (!this.isEmpty()) {
            this.exec(thread);
        }
    }

    /**
     * 
     * 清空队列
     */
    clear() {
        this._queue = [];
        log.success('队列清空');
    }

    /**
     * 
     * 终止队列
     */
    abort() {
        this._queue = [];
        this._status = false;
        log.success('队列终止');
    }

    /**
     * 打印当前队列
     */
    print() {
        log.info(JSON.stringify(this._queue));
    }
}


// 示例
const queue = new Queue({ concurrency: 2, name: 'queue' });

queue.on('taskError', function (taskName) {
    this.print();
    // this.abort();
});

[{ name: 'task1', err: '', value: 'success1', timeout: 2000 },
{ name: 'task2', err: '', value: '', timeout: 1000 },
{ name: 'task3', err: 'error2', value: '', timeout: 500 },
{ name: 'task4', err: '', value: 'success2', timeout: 1500 },
{ name: 'task5', err: 'error3', value: '', timeout: 3000 }]
    .forEach((options) => {
        queue.enqueue({ name: options.name, task: () => request(options) });
    })