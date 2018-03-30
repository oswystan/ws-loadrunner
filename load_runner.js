/*
 *********************************************************************************
 *                     Copyright (C) 2018 wystan
 *
 *       filename: load_runner.js
 *    description:
 *        created: 2018-03-27 15:52:58
 *         author: wystan
 *
 *********************************************************************************
 */
const logv   = require("./log").logv;
const logd   = require("./log").logd;
const logi   = require("./log").logi;
const logw   = require("./log").logw;
const loge   = require("./log").loge;
const report = require("./report");
const errno  = report.ERRNO;
const emitter = require('./emitter');
const WebSocket = require('ws');

const POOL_NAME = "fixed";

class LoadRunner {
    constructor(argv) {
        this.inner_emitter  = emitter();
        this.outer_emitter  = emitter();

        this.pool           = ConnectionPoolFactory.create(POOL_NAME);
        this.worker_group   = new WorkerGroup();
        this.argv           = argv;
        this.main_report    = null;
        this.counter_report = 0;
    }
    /**
     * messages avaliable:
     *     prepared   - handler();
     *     finished   - handler(MainReport);
     *     error      - handler({error: ERRNO, desc: ''});
     *     connection - handler({connected: cnt, failed: cnt});
     *     progress   - handler({counter: $report_cnt});
     */
    on(msg, handler) {
        this.outer_emitter.on(msg, handler);
    }
    prepare() {
        let pool = this.pool;
        let app = null;

        this.install_pool_handler();
        this.install_workergroup_handler();

        try {
            app = require("./" + this.argv.name);
        } catch(e) {
            this.outer_emitter.aemit("error", {error: errno.MODULE_NOT_FOUND, desc: e.code});
            return;
        }
        if (app && app.url) {
            this.argv.url = app.url;
        }
        this.main_report = report("main", this.argv);

        if (pool) {
            pool.open(this.argv.amount, this.argv.url);
        }
    }
    start() {
        this.counter_report = 0;
        this.main_report.start();
        this.install_inner_handler();
        this.pool.start();
        this.worker_group.create(this.argv.amount, this.argv.name);
        this.worker_group.start(this.pool);

        let runner = this;
        setTimeout(()=>{
            runner.inner_emitter.emit("exit");
        }, this.argv.time * 1000);
    }
    stop() {}

    //=========================================================
    // connection pool callback handler
    //=========================================================
    on_connection_pool_error(e) {
        this.outer_emitter.aemit("error", e);
    }
    on_connection_pool_opened() {
        this.outer_emitter.aemit("prepared");
    }
    on_connection_progress(msg) {
        this.outer_emitter.aemit("connection", msg);
    }

    //=========================================================
    // worker group callback handler
    //=========================================================
    on_worker_report(report) {
        this.counter_report++;
        this.outer_emitter.aemit("progress", {counter: this.counter_report});
        this.main_report.on_worker_report(report);
    }

    //=========================================================
    // internal message callback handler
    //=========================================================
    on_exit() {
        this.main_report.stop();
        this.worker_group.stop();
        this.worker_group.destroy();
        this.pool.stop();
        this.pool.close();
        this.outer_emitter.aemit("finished", this.main_report);
    }

    //=========================================================
    // private function
    //=========================================================
    install_inner_handler() {
        this.inner_emitter.on("exit", this.on_exit.bind(this));
    }
    install_pool_handler() {
        let pool = this.pool;
        pool.on("opened", this.on_connection_pool_opened.bind(this));
        pool.on("error", this.on_connection_pool_error.bind(this));
        pool.on("progress", this.on_connection_progress.bind(this));
    }
    install_workergroup_handler() {
        this.worker_group.on("worker-report", this.on_worker_report.bind(this));
    }
};

class ConnectionPoolFactory {
    static create(name) {
        if (name === "fixed") {
            return new ConnectionPool();
        }

        return null;
    }
};

class ConnectionPool {
    constructor() {
        this.pool   = [];
        this.active = [];
        this.needed = 0;
        this.url    = "";

        this.inner_emitter  = emitter();
        this.outer_emitter  = emitter();
        this.counter_failed = 0;
        this.failed_threshold = 20;
    }

    open(cnt, url) {
        this.needed = cnt;
        this.url    = url;
        this.inner_emitter.on("open", this.on_open.bind(this));
        this.inner_emitter.aemit("open");
    }

    close() {
        this.inner_emitter.off("open");
        this.pool.forEach((c)=>{
            c.close();
        });
    }

    /**
     * messages avaliable:
     *     error    - handler({error: ERRNO, desc: ''})
     *     opened   - handler();
     *     closed   - handler();
     *     progress - handler({connected: cnt, failed: cnt});
     */
    on(msg, handler) {
        this.outer_emitter.on(msg, handler);
    }

    start() {
        this.pool.forEach( c => {
            this.active.push(c);
        });
    }
    stop() {
        this.active = [];
    }

    get() {
        return this.active.pop();
    }
    put(connection) {
        this.active.push(connection);
    }

    //============================================
    // private function
    //============================================
    on_open() {
        let conn = new WebSocket(this.url);
        let cp = this;
        conn.on("open", function() {
            cp.pool.push(conn);
            if (cp.pool.length == cp.needed) {
                cp.outer_emitter.aemit("opened");
            } else {
                cp.outer_emitter.aemit("progress", {connected: cp.pool.length, failed: cp.counter_failed});
                cp.inner_emitter.aemit("open");
            }
        });
        conn.on("close", function(){
            cp.pool.splice(cp.pool.indexOf(conn)>>>0, 1);
            if (cp.pool.length === 0) {
                cp.outer_emitter.aemit("closed");
            }
        });
        conn.on("error", function(e) {
            cp.counter_failed++;
            cp.outer_emitter.aemit("progress", {connected: cp.pool.length, failed: cp.counter_failed});
            conn.close();
            if (cp.counter_failed < cp.failed_threshold) {
                cp.inner_emitter.aemit("open");
            } else {
                cp.outer_emitter.aemit("error", {error: errno.CONN_ERR, desc: "too many connection failed"});
            }
        });
    }
};

class WorkerGroup {
    constructor() {
        this.exit = 0;
        this.apps = [];
        this.pool = null;
        this.outer_emitter = emitter();
        this.counter = 0;
    }
    create(cnt, app_name) {
        while (cnt > 0) {
            this.apps.push(require('./' + app_name).WorkerApp());
            cnt--;
        }
    }
    destroy() {
        this.apps = [];
    }
    start(connection_pool) {
        this.exit = 0;
        this.counter = 0;
        this.apps.forEach(app => {
            let conn = connection_pool.get();
            if (conn) {
                app.on("finished", this.on_app_finished.bind(this));
                app.on("error", this.on_app_error.bind(this));
                app.start(conn);
            }
        });
        this.pool = connection_pool;
    }
    stop() {
        this.exit = 1;
        this.apps.forEach(app => {
            app.stop();
        });
    }

    on_app_finished(report, app) {
        this.outer_emitter.emit("worker-report", report);
        app.stop();
        if (this.exit) {
            this.outer_emitter.aemit("finished");
            return;
        }

        //start next round
        this.pool.put(app.get_connection());
        let conn = this.pool.get();
        if (conn) {
            app.start(conn);
        }
    }
    on_app_error(err, app) {
        this.outer_emitter.aemit("error", err);
    }

    /**
     * messages avaliable:
     *     finished        - handler();
     *     error           - handler({error: ERRNO, desc: ''}, WorkerGroup)
     *     worker-report   - handler(WorkerReport);
     */
    on(msg, handler) {
        this.outer_emitter.on(msg, handler);
    }
};

class WorkerApp {
    constructor() {
        this.connection = null;
        this.outer_emitter = emitter();
    }
    start(connection) {
        if (connection) {
            this.connection = connection;
            connection.removeAllListeners("message");
            //bind the app callback to connection
        }
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

module.exports = function(argv) {
    return new LoadRunner(argv);
};

/************************************* END **************************************/

