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

const logv   = require("./log").logv;
const logd   = require("./log").logd;
const logi   = require("./log").logi;
const logw   = require("./log").logw;
const loge   = require("./log").loge;
const report = require("./report");
const errno  = report.ERRNO;

class ClusterWorker {
    constructor() {
        this.msg_handler = this.on_master_msg.bind(this);
    }
    run(argv) {
        process.on("message", this.msg_handler);
        this.main_report = report("main", argv);
        this.main_report.start();
    }

    on_master_msg(msg) {
        if (msg.type === "request") {
            switch(msg.cmd)
            {
                case "start":
                {
                    //TODO
                    process.send({type:"response", cmd: msg.cmd, error: errno.SUCC});
                    setTimeout(() => {
                        this.main_report.stop();
                        process.send({type: "report", report: this.main_report.jsonify()});
                    }, 1000);
                    break;
                };
                case "stop" :
                {
                    process.send({type:"response", cmd: msg.cmd, error: errno.SUCC});
                    break;
                }
                case "exit" :
                {
                    let code = this.main_report ? this.main_report.error : 0;
                    process.exit(code);
                    break;
                }
                case "create" :
                {
                    logd("create", msg.name);
                    process.send({type:"response", cmd: msg.cmd, error: errno.SUCC});
                    break;
                }
                case "destroy" :
                {
                    process.send({type:"response", cmd: msg.cmd, error: errno.SUCC});
                    break;
                }
                default:
                {
                    process.send({type: "response", cmd: msg.cmd, error: errno.INVAL});
                }
            }
        }
    }

    on_master_create_req(msg) {}
    on_master_destroy_req(msg) {}
    on_master_start_req(msg) {}
    on_master_stop_req(msg) {}
    on_master_exit_req(msg) {}
};

module.exports = function() {
    return new ClusterWorker();
};

/************************************* END **************************************/

