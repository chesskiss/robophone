// DISCOVERY HELPER: DEEP SCANNER
// Run this in the console to find the hidden Blockly Workspace object.

(function () {
    console.log("🕵️‍♀️ Starting Deep Scan for Blockly Workspace...");

    // Signature match: Checks if an object looks like a Workspace
    function isWorkspace(obj) {
        return obj &&
            typeof obj === 'object' &&
            typeof obj.newBlock === 'function' &&
            typeof obj.getAllBlocks === 'function' &&
            typeof obj.addChangeListener === 'function';
    }

    // 1. Check Global
    if (typeof Blockly !== 'undefined') {
        if (isWorkspace(Blockly.getMainWorkspace?.())) {
            console.log("✅ Found via Blockly.getMainWorkspace()");
            return expose(Blockly.getMainWorkspace());
        }
    }

    // 2. Scan DOM Elements (Breadth-First)
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
        // Direct property check
        if (isWorkspace(el.workspace)) {
            console.log("✅ Found 'workspace' property on element:", el);
            return expose(el.workspace);
        }
        if (isWorkspace(el.blockly_workspace)) { // Some custom integrations
            console.log("✅ Found 'blockly_workspace' property on element:", el);
            return expose(el.blockly_workspace);
        }

        // Framework Props (React/Vue/Angular)
        for (const key in el) {
            // React internal instances
            if (key.startsWith('__react') || key.startsWith('__vue')) {
                const internal = el[key];
                // Shallow walk of internal properties
                if (internal && internal.memoizedProps && isWorkspace(internal.memoizedProps.workspace)) {
                    console.log("✅ Found inside React Props on element:", el);
                    return expose(internal.memoizedProps.workspace);
                }
            }
        }
    }

    console.log("❌ Deep Scan Complete. No Workspace object found attached to DOM.");
    console.log("👉 Suggestion: Look for the variable name in your source code where 'inject' is called.");

    function expose(ws) {
        window.foundWorkspace = ws;
        console.log("🎉 SUCCESS! The Workspace object is now available as global variable:");
        console.log(">> window.foundWorkspace");
        console.log("You can now run: window.foundWorkspace.getAllBlocks()");

        // Setup logger
        ws.addChangeListener(e => {
            if (e.type === 'create') { // 'create' or string constant
                const block = ws.getBlockById(e.blockId);
                if (block) console.log(`[Spawned] Type: "${block.type}"`);
            }
        });
        console.log("Listener attached. Drag a block to see its Type.");

        return ws;
    }
})();
