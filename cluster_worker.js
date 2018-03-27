/*
 *********************************************************************************
 *                     Copyright (C) 2018 wystan
 *
 *       filename: cluster_worker.js
 *    description:
 *        created: 2018-03-27 15:52:52
 *         author: wystan
 *
 *********************************************************************************
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const logv = require("./log").logv;
const logd = require("./log").logd;
const logi = require("./log").logi;
const logw = require("./log").logw;
const loge = require("./log").loge;

class MainReport {
    constructor(argv) {
        this.url               = argv.url;
        this.connections       = argv.amount;
        this.cocurrency        = argv.cocurrency;
        this.tps               = 0;
        this.total_response_ms = 0;
        this.max_response_ms   = 0;
        this.min_response_ms   = Number.MAX_VALUE;
        this.avg_response_ms   = 0;
        this.total_request     = 0;
        this.duration_in_sec   = 0;
        this.start_time        = new Date();
        this.end_time          = new Date();
        this.errors            = 0;
    }
};

class ClusterWorker {
    constructor() {
        this.msg_handler = this.on_msg.bind(this);
    }
    run(argv) {
        process.on("message", this.msg_handler);
        this.main_report = new MainReport(argv);
        this.argv = argv;
    }

    on_msg(msg) {
        process.send({type: "response", cmd:msg.cmd, error: 0});
        if (msg.cmd === "start") {
            setTimeout(()=>{
                process.send({type: "report", report: this.main_report});
            }, 1000);
        } else if (msg.cmd === "exit") {
            process.exit(0);
        }
    }
};

module.exports = function() {
    return new ClusterWorker();
};

/************************************* END **************************************/

