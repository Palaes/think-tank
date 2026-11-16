class TextForgeWebUI {
    static initialize() {
        const script = document.getElementById("scriptInput");
        const input = document.getElementById("inputText");
        const output = document.getElementById("outputText");
        const scriptSelect = document.getElementById("scriptSelect");
        const runButton = document.getElementById("runButton");
        const applyButton = document.getElementById("applyButton");
        const clearButton = document.getElementById("clearButton");
        const copyButton = document.getElementById("copyButton");
        TextForgeWebUI.restore(TextForgeWebUI.scriptKey, script);
        TextForgeWebUI.restore(TextForgeWebUI.inputKey, input);
        TextForgeWebUI.restore(TextForgeWebUI.outputKey, output);
        script.addEventListener("input", () => TextForgeWebUI.save(TextForgeWebUI.scriptKey, script));
        input.addEventListener("input", () => TextForgeWebUI.save(TextForgeWebUI.inputKey, input));
        output.addEventListener("input", () => TextForgeWebUI.save(TextForgeWebUI.outputKey, output));
        scriptSelect.addEventListener("change", () => {
            TextForgeWebUI.selectScript(scriptSelect, script);
        });
        runButton.addEventListener("click", () => {
            TextForgeWebUI.run(script, input, output);
        });
        applyButton.addEventListener("click", () => {
            input.value = output.value;
            output.value = "";
            TextForgeWebUI.save(TextForgeWebUI.inputKey, input);
            TextForgeWebUI.save(TextForgeWebUI.outputKey, output);
        });
        clearButton.addEventListener("click", () => {
            script.value = "";
            input.value = "";
            output.value = "";
            TextForgeWebUI.save(TextForgeWebUI.scriptKey, script);
            TextForgeWebUI.save(TextForgeWebUI.inputKey, input);
            TextForgeWebUI.save(TextForgeWebUI.outputKey, output);
        });
        copyButton.addEventListener("click", () => {
            TextForgeWebUI.runAction(false, async () => {
                await navigator.clipboard.writeText(output.value);
            });
        });
        TextForgeWebUI.loadScripts(scriptSelect);
    }
    static restore(key, element) {
        const value = localStorage.getItem(key);
        if (value != null) {
            element.value = value;
        }
    }
    static save(key, element) {
        localStorage.setItem(key, element.value);
    }
    static async runAction(long, action) {
        if (TextForgeWebUI.busy) {
            return;
        }
        TextForgeWebUI.busy = true;
        document.body.classList.add(long ? "blockRun" : "blockAll");
        try {
            await action();
        }
        finally {
            document.body.classList.remove("blockAll");
            document.body.classList.remove("blockRun");
            TextForgeWebUI.busy = false;
        }
    }
    static async loadScripts(scriptSelect) {
        await TextForgeWebUI.runAction(false, async () => {
            const response = await fetch("/api/scripts", { cache: "no-store" });
            if (response.ok) {
                const names = await response.json();
                for (const name of names) {
                    const option = document.createElement("option");
                    option.value = name;
                    option.textContent = name;
                    scriptSelect.appendChild(option);
                }
            }
            else {
                alert(`unable to load scripts: ${response.status}`);
            }
        });
    }
    static async selectScript(scriptSelect, script) {
        const name = scriptSelect.value;
        if (name) {
            await TextForgeWebUI.runAction(false, async () => {
                const response = await fetch("/api/script", {
                    method: "POST",
                    cache: "no-store",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name })
                });
                if (response.ok) {
                    script.value = await response.text();
                    TextForgeWebUI.save(TextForgeWebUI.scriptKey, script);
                }
                else {
                    alert(`unable to load script: ${response.status}`);
                }
            });
        }
    }
    static async run(script, input, output) {
        await TextForgeWebUI.runAction(true, async () => {
            output.value = "";
            const response = await fetch("/api/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: script.value,
                    input: input.value
                })
            });
            if (response.ok) {
                await TextForgeWebUI.readResponse(response, output);
                TextForgeWebUI.save(TextForgeWebUI.outputKey, output);
            }
            else {
                alert(`request failed: ${response.status}`);
            }
        });
    }
    static async readResponse(response, output) {
        if (response.body == null) {
            return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
            const result = await reader.read();
            if (result.done) {
                break;
            }
            buffer += decoder.decode(result.value, { stream: true });
            buffer = TextForgeWebUI.processLines(buffer, output);
        }
        buffer += decoder.decode();
        if (buffer) {
            TextForgeWebUI.processLine(buffer, output);
        }
    }
    static processLines(buffer, output) {
        let index = buffer.indexOf("\n");
        while (index >= 0) {
            const line = buffer.slice(0, index);
            buffer = buffer.slice(index + 1);
            if (line) {
                TextForgeWebUI.processLine(line, output);
            }
            index = buffer.indexOf("\n");
        }
        return buffer;
    }
    static processLine(line, output) {
        const event = JSON.parse(line);
        if (event.type == "stream") {
            output.value += event.text;
        }
        else if (event.type == "output") {
            output.value = event.text;
        }
        else if (event.type == "error") {
            output.value += `\n\n[Error: ${event.message}]`;
        }
    }
}
TextForgeWebUI.scriptKey = "textforge.script";
TextForgeWebUI.inputKey = "textforge.input";
TextForgeWebUI.outputKey = "textforge.output";
TextForgeWebUI.busy = false;
TextForgeWebUI.initialize();
