/*
 *********************************************************************************
 *                     Copyright (C) 2018 wystan
 *
 *       filename: random.js
 *    description:
 *        created: 2018-03-27 15:53:04
 *         author: wystan
 *
 *********************************************************************************
 */
const logv   = require("./log").logv;
const logd   = require("./log").logd;
const logi   = require("./log").logi;
const logw   = require("./log").logw;
const loge   = require("./log").loge;
const report = require('./report');
const emitter = require('./emitter');

function random(max) {
    return Math.floor(Math.random() * max);
}

class RandomAppWorker {
    constructor() {
        this.connection = null;
        this.outer_emitter = emitter();
        this.worker_report = null;
    }
    start(connection) {

        if (connection) {
            this.connection = connection;
            connection.removeAllListeners("message");
            //bind the app callback to connection
        }
        this.worker_report = report("worker");
        this.worker_report.start = Date.now();

        let app = this;
        setTimeout(() => {
            let worker_report = this.worker_report;
            worker_report.total_request = 1;
            worker_report.end = Date.now();
            worker_report.total_response_ms = worker_report.end - worker_report.start;
            worker_report.min_response_ms = random(worker_report.total_response_ms/2);
            worker_report.max_response_ms = random(worker_report.total_response_ms);

            app.outer_emitter.aemit("finished", worker_report, app);
        }, random(20));
    }
    stop() {
        if (this.connection) {
            this.connection.removeAllListeners("message");
        }
    }
    get_connection() {
        return this.connection;
    }

    /**
     * messages avaliable:
     *     finished - handler(WorkerReport, WorkerApp);
     *     error    - handler({error: ERRNO, desc: ''}, WorkerApp);
     */
    on(msg, handler) {
        this.outer_emitter.on(msg, handler);
    }
};

//module.exports.url = "wss://47.100.110.3:7788/ares/v1.0.0";

module.exports.WorkerApp = function() {
    return new RandomAppWorker();
};

/************************************* END **************************************/

