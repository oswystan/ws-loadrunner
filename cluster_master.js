/*
 *********************************************************************************
 *                     Copyright (C) 2018 wystan
 *
 *       filename: cluster_master.js
 *    description:
 *        created: 2018-03-27 15:52:45
 *         author: wystan
 *
 *********************************************************************************
 */

const logv = require("./log").logv;
const logd = require("./log").logd;
const logi = require("./log").logi;
const logw = require("./log").logw;
const loge = require("./log").loge;
const log  = require("./log").log;
const emitter = require('./emitter');
const report = require('./report');
const printf = require('printf');

class ClusterMaster {
    constructor() {
        this.workers     = [];
        this.msg_create  = {type:'request', cmd:'create',  name:'random'};
        this.msg_destroy = {type:'request', cmd:'destroy', name:'random'};
        this.msg_start   = {type:'request', cmd:'start',   name:'random'};
        this.msg_stop    = {type:'request', cmd:'stop',    name:'random'};
        this.msg_exit    = {type:'request', cmd:'exit'};

        this.reset_counter();
        this.inner_emitter = emitter();
    }
    run(cluster, argv) {
        logi("master running...");

        this.msg_create  = {type:'request', cmd:'create',  name:argv.name};
        this.msg_destroy = {type:'request', cmd:'destroy', name:argv.name};
        this.msg_start   = {type:'request', cmd:'start',   name:argv.name};
        this.msg_stop    = {type:'request', cmd:'stop',    name:argv.name};

        this.workers     = [];
        this.argv        = argv;
        this.cluster_report = report('cluster', argv);
        this.reset_counter();
        this.cnt_workers = argv.worker;
        for (let i=0; i<argv.worker; i++) {
            cluster.fork();
        }

        cluster.on('online', (worker)=>{
            worker.connection = {connected: 0, failed: 0};
            worker.progress = {counter: 0};
            worker.main_report_ = report("main", argv);
            this.workers.push(worker);
            if (this.workers.length === argv.worker) {
                logi("all workers online:");
                this.dump_workers();
                this.send_worker_request(this.msg_create);
            }
        });

        cluster.on('exit', (worker)=>{
            logi("worker", worker.process.pid, "exit.");
            this.workers.splice(this.workers.indexOf(worker)>>>0, 1);
            if (this.workers.length === 0) {
                logi("all workers exit.");
                log(this.cluster_report.stringify());
                process.exit(0);
            }
        });

        this.inner_emitter.on("response create", this.on_resp_create.bind(this));
        this.inner_emitter.on("response destroy", this.on_resp_destroy.bind(this));
        this.inner_emitter.on("response start", this.on_resp_start.bind(this));
        this.inner_emitter.on("response stop", this.on_resp_stop.bind(this));
        this.inner_emitter.on("notify report", this.on_report.bind(this));
        this.inner_emitter.on("notify error", this.on_error.bind(this));
        this.inner_emitter.on("notify connection", this.on_notify_connection.bind(this));
        this.inner_emitter.on("notify progress", this.on_notify_progress.bind(this));

        cluster.on('message', (worker, message, handle) => {
            //logd(message);
            let msg = message.type + " " + message.cmd;
            this.inner_emitter.aemit(msg, message, worker);
        });
    }

    send_worker_request(req, worker) {
        if (worker) {
            worker.send(req);
        } else {
            this.workers.forEach((worker) => {
                worker.send(req);
            });
        }
    }

    dump_workers() {
        let workers = this.workers;
        workers.forEach((worker) => {
            logi("worker:", worker.process.pid);
        });
    }

    on_resp_create(msg, worker) {
        if (msg.error != 0) {
            loge("fail to create runner: ", msg.error, msg.desc);
            this.send_worker_request(this.msg_exit, worker);
            return;
        }

        this.cnt_created++;
        if(this.cnt_created === this.cnt_workers) {
            logd("all workers created");
            this.send_worker_request(this.msg_start);
        }
    }
    on_resp_destroy(msg) {
        this.cnt_destroyed++;
        if(this.cnt_destroyed === this.cnt_workers) {
            logd("all workers destroyed");
            this.send_worker_request(this.msg_exit);
        }
    }
    on_resp_start(msg) {
        if (msg.error == 0) {
            this.cnt_started++;
        }
        if(this.cnt_started === this.cnt_workers) {
            logi("all workers started");
        }
    }
    on_resp_stop(msg) {
        if (msg.error == 0) {
            this.cnt_stoped++;
        }
        if(this.cnt_stoped === this.cnt_workers) {
            logd("all workers stoped");
            this.send_worker_request(this.msg_destroy);
        }
    }
    on_report(msg, worker) {
        worker.main_report_.parse(msg.report);
        logd(printf("report from worker: %d\n", worker.process.pid), worker.main_report_.stringify());
        this.cnt_report++;
        this.cluster_report.on_main_report(worker.main_report_);
        if (this.cnt_report === this.cnt_workers) {
            logd("all report received.");
            this.send_worker_request(this.msg_stop);
        }
    }
    on_error(msg, worker) {
        loge(msg);
        this.cluster_report.on_error();
        this.send_worker_request(this.msg_exit, worker);
    }
    on_notify_connection(msg, worker) {
        worker.connection.connected = msg.data.connected;
        worker.connection.failed = msg.data.failed;
        this.show_connection_status();
    }
    on_notify_progress(msg, worker) {
        worker.progress = msg.data;
        this.show_progress_status();
    }

    reset_counter() {
        this.cnt_created   = 0;
        this.cnt_destroyed = 0;
        this.cnt_started   = 0;
        this.cnt_stoped    = 0;
        this.cnt_workers   = 0;
        this.cnt_report    = 0;
    }

    show_connection_status() {
        let cnt_connected = 0;
        let cnt_failed = 0;
        this.workers.forEach(worker => {
            cnt_connected += worker.connection.connected;
            cnt_failed += worker.connection.failed;
        });
        log(printf("%9s : [%8d]  %10s : [%8d]\r", "connected", cnt_connected, "failed", cnt_failed));
    }

    show_progress_status() {
        let counter = 0;
        this.workers.forEach(worker => {
            counter += worker.progress.counter;
        });
        log(printf("%22s : [%10d]\r", "worker report received", counter));
    }
};

module.exports = function() {
    return new ClusterMaster();
};

/************************************* END **************************************/
