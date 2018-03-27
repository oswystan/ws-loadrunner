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

class ClusterMaster {
    constructor() {
        this.workers     = [];
        this.msg_create  = {type:'request', cmd:'create',  name:'random'};
        this.msg_destroy = {type:'request', cmd:'destroy', name:'random'};
        this.msg_start   = {type:'request', cmd:'start',   name:'random'};
        this.msg_stop    = {type:'request', cmd:'stop',    name:'random'};
        this.msg_exit    = {type:'request', cmd:'exit'};

        this.reset_counter();
    }
    run(cluster, argv) {
        logi("master running...");

        this.workers     = [];
        this.reset_counter();
        this.cnt_workers = argv.worker;
        for (let i=0; i<argv.worker; i++) {
            cluster.fork();
        }

        cluster.on('online', (worker)=>{
            this.workers.push(worker);
            if (this.workers.length === argv.worker) {
                logi("all workers online");
                this.dump_workers();
                this.send_worker_request(this.msg_create);
            }
        });

        cluster.on('exit', (worker)=>{
            this.workers.splice(this.workers.indexOf(worker)>>>0, 1);
            if (this.workers.length === 0) {
                logi("all workers exit.");
                process.exit(0);
            }
        });

        cluster.on('message', (worker, message, handle) => {
            // logd(message);
            if (message.type === "response") {
                if (message.cmd === "create") {
                    this.on_resp_create(message);
                } else if (message.cmd === "destroy") {
                    this.on_resp_destroy(message);
                } else if (message.cmd === "start") {
                    this.on_resp_start(message);
                } else if (message.cmd === "stop") {
                    this.on_resp_stop(message);
                }
            } else if(message.type ==="report") {
                this.on_report(worker, message);
            }
        });
    }

    send_worker_request(req) {
        this.workers.forEach((worker) => {
            worker.send(req);
        });
    }

    dump_workers() {
        let workers = this.workers;
        workers.forEach((worker) => {
            logd("worker:", worker.process.pid);
        });
    }

    on_resp_create(msg) {
        if (msg.error == 0) {
            this.cnt_created++;
        }
        if(this.cnt_created === this.cnt_workers) {
            logd("all workers created");
            this.send_worker_request(this.msg_start);
        }
    }
    on_resp_destroy(msg) {
        if (msg.error == 0) {
            this.cnt_destroied++;
        }
        if(this.cnt_destroied === this.cnt_workers) {
            logd("all workers destroied");
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
            this.send_worker_request(this.msg_destroy);
        }
    }
    on_report(worker, msg) {
        worker.main_report_ = msg.report;
        this.cnt_report++;
        if (this.cnt_report === this.cnt_workers) {
            logd("all report received.");
            this.send_worker_request(this.msg_stop);
        }
    }

    reset_counter() {
        this.cnt_created   = 0;
        this.cnt_destroied = 0;
        this.cnt_started   = 0;
        this.cnt_stoped    = 0;
        this.cnt_workers   = 0;
        this.cnt_report    = 0;
    }
};

module.exports = function() {
    return new ClusterMaster();
};

/************************************* END **************************************/
