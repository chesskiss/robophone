// WORKSPACE SPY — document_start, MAIN world
// Patches Object.create before webpack runs so we can intercept WorkspaceDB_.
// When Blockly's workspace.js evaluates (line 771):
//   Blockly.Workspace.WorkspaceDB_ = Object.create(null);
// our patch wraps it in a Proxy. When the first non-flyout workspace is
// registered (workspace.js:43):
//   Blockly.Workspace.WorkspaceDB_[this.id] = this;
// the Proxy set-trap captures it at window.__robophoneWs and restores
// Object.create. The main workspace is always constructed before its flyout,
// so the first hit is always the workspace we want.
(function () {
    function isWorkspace(obj) {
        return obj &&
            typeof obj === 'object' &&
            typeof obj.newBlock === 'function' &&
            typeof obj.getAllBlocks === 'function' &&
            typeof obj.addChangeListener === 'function';
    }

    const origCreate = Object.create.bind(Object);
    Object.create = function (proto, properties) {
        const result = origCreate(proto, properties);
        if (proto === null) {
            return new Proxy(result, {
                set(target, key, value) {
                    target[key] = value;
                    if (!window.__robophoneWs && isWorkspace(value)) {
                        window.__robophoneWs = value;
                        Object.create = origCreate; // restore — no more overhead
                    }
                    return true;
                }
            });
        }
        return result;
    };
})();
