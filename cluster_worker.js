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

const loadrunner = require('./load_runner');
const emitter    = require('./emitter');

class ClusterWorker {
    constructor() {
        this.msg_handler = this.on_master_msg.bind(this);
        this.inner_emitter = emitter();
        this.cur_msg = null;
    }

    run(argv) {
        this.argv = argv;
        this.install_master_handler();
        process.on("message", this.msg_handler);
    }

    on_master_msg(msg) {
        this.cur_msg = msg;
        this.inner_emitter.emit(msg.type + " " + msg.cmd, msg);
    }

    on_master_create_req(msg) {
        let runner = loadrunner(this.argv);
        this.runner = runner;
        this.install_runner_handler();
        runner.prepare();
    }

    on_master_destroy_req(msg) {
        this.runner = null;
        this.send_resp({type:"response", cmd: msg.cmd, error: errno.SUCC});
    }

    on_master_start_req(msg) {
        if (!this.runner) {
            this.send_resp({type:"response", cmd: msg.cmd, error: errno.EPERM});
            return;
        }

        this.runner.start();
        this.send_resp({type:"response", cmd: msg.cmd, error: errno.SUCC});
        this.main_report = report("main", this.argv);
        this.main_report.start();
    }

    on_master_stop_req(msg) {
        if (!this.runner) {
            this.send_resp({type:"response", cmd: msg.cmd, error: errno.EPERM});
            return;
        }

        this.runner.stop();
        this.send_resp({type:"response", cmd: msg.cmd, error: errno.SUCC});
    }

    on_master_exit_req(msg) {
        let code = this.main_report ? this.main_report.error : 0;
        process.exit(code);
    }

    on_runner_prepared() {
        this.send_resp({type:"response", cmd: "create", error: errno.SUCC});
    }

    on_runner_finished(msg) {
        this.send_notify({type: "notify", cmd: "report", report: msg});
    }

    on_runner_error(e) {
        if (this.cur_msg) {
            this.send_resp({type: "response", cmd: this.cur_msg.cmd, error: e.error, desc: e.desc});
        } else {
            this.send_notify({type: "notify", cmd: "error", error: e.error, desc: e.desc});
        }
    }

    on_runner_connection(msg) {
        this.send_notify({type: "notify", cmd: "connection", data: msg});
    }

    on_runner_progress(msg) {
        this.send_notify({type: "notify", cmd: "progress", data: msg});
    }

    install_master_handler() {
        this.inner_emitter.on("request create",  this.on_master_create_req.bind(this));
        this.inner_emitter.on("request destroy", this.on_master_destroy_req.bind(this));
        this.inner_emitter.on("request start",   this.on_master_start_req.bind(this));
        this.inner_emitter.on("request stop",    this.on_master_stop_req.bind(this));
        this.inner_emitter.on("request exit",    this.on_master_exit_req.bind(this));
    }

    install_runner_handler() {
        if (!this.runner) return;
        let runner = this.runner;
        runner.on("prepared", this.on_runner_prepared.bind(this));
        runner.on("finished", this.on_runner_finished.bind(this));
        runner.on("connection", this.on_runner_connection.bind(this));
        runner.on("progress", this.on_runner_progress.bind(this));
        runner.on("error", this.on_runner_error.bind(this));
    }

    send_resp(resp) {
        this.cur_msg = null;
        process.send(resp);
    }
    send_notify(msg) {
        process.send(msg);
    }
};

module.exports = function() {
    return new ClusterWorker();
};

/************************************* END **************************************/

