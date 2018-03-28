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

class LoadRunner {
    constructor(argv) {
        this.inner_emitter = emitter();
        this.outer_emitter = emitter();

        this.connection_pool = new ConnectionPool();
        this.worker_group    = new WorkerGroup();
        this.argv = argv;
        this.exit = 0;
        this.main_report = null;

        //FIXME
        this.emu_connection_counter = 0;
        this.emu_worker_counter = 0;
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
        let cp = this.connection_pool;
        cp.on("finished", this.on_connection_pool_finished.bind(this));
        cp.on("error", this.on_connection_pool_error.bind(this));
        cp.on("progress", this.on_connection_progress.bind(this));

        let app = null;
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

        if (cp) {
            cp.create(this.argv.amount, this.argv.url);
        }
    }
    start() {
        this.exit = 0;
        this.main_report.start();
        this.emulate_worker_progress();
        this.install_inner_handler();

        let runner = this;
        setTimeout(()=>{
            runner.inner_emitter.emit("exit");
        }, this.argv.time * 1000);
    }
    stop() {
        this.exit = 1;
    }

    on_connection_pool_error(e) {
        this.outer_emitter.aemit("error", e);
    }
    on_connection_pool_finished() {
        this.outer_emitter.aemit("prepared");
        logd("prepared");
    }
    on_connection_progress(msg) {
        this.outer_emitter.aemit("connection", msg);
    }
    on_worker_progress(msg) {
        this.outer_emitter.aemit("progress", msg);
    }

    on_exit() {
        this.exit = 1;
        this.main_report.stop();

        //TODO stop worker group and connection pool

        this.outer_emitter.aemit("finished", this.main_report);
    }

    install_inner_handler() {
        this.inner_emitter.on("exit", this.on_exit.bind(this));
    }
    emulate_connection_progress() {
        let runner = this;
        runner.on_connection_progress({connected: runner.emu_connection_counter++, failed: runner.emu_connection_counter});
        if (runner.exit == 0) {
            setTimeout(runner.emulate_connection_progress.bind(runner), 100);
        }
    }
    emulate_worker_progress() {
        let runner = this;
        runner.on_worker_progress({counter: runner.emu_worker_counter++});
        if (runner.exit == 0) {
            setTimeout(runner.emulate_worker_progress.bind(runner), 100);
        }
    }
};

class ConnectionPool {
    constructor() {
        this.pool = [];
        this.needed = 0;
        this.url = "";

        this.inner_emitter = emitter();
        this.outer_emitter = emitter();
        this.counter_failed = 0;
    }

    create(cnt, url) {
        this.needed = cnt;
        this.url = url;
        this.create_connection();
    }

    destroy() {
        this.pool.forEach((c)=>{
            c.close();
        });
        this.pool = [];
    }

    create_connection() {
        let conn = new WebSocket(this.url);
        let cp = this;
        conn.on("open", function() {
            cp.pool.push(conn);
            if (cp.pool.length == cp.needed) {
                cp.outer_emitter.aemit("finished");
            } else {
                cp.outer_emitter.aemit("progress", {connected: cp.pool.length, failed: cp.counter_failed});
                cp.create_connection();
            }
        });
        conn.on("close", function(){
            logd("close");
            cp.pool.splice(cp.pool.indexOf(conn)>>>0, 1);
        });
        conn.on("error", function(e) {
            loge(e);
            this.counter_failed++;
            conn.close();
        });
    }
    /**
     * messages avaliable:
     *     error    - handler({error: ERRNO, desc: ''})
     *     finished - handler();
     *     progress - handler({connected: cnt, failed: cnt});
     */
    on(msg, handler) {
        this.outer_emitter.on(msg, handler);
    }

    get() { return null; }
    put(connection) {}
};

class WorkerGroup {
    constructor() {}
    create(cnt, app_name) {}
    destroy() {}
    start(connection_pool) {}
    stop() {}

    /**
     * messages avaliable:
     *     finished - handler(report);
     *     error    - handler({error: ERRNO, desc: ''})
     *     progress - handler();
     */
    on(msg, handler) {}
};

class WorkerApp {
    constructor() {}
    start(connection) {}
    stop() {}

    /**
     * messages avaliable:
     *     finished - handler(WorkerReport);
     *     error    - handler({error: ERRNO, desc: ''});
     */
    on(msg, handler) {}
};

module.exports = function(argv) {
    return new LoadRunner(argv);
};

/************************************* END **************************************/

