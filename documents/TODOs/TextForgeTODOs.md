Sources:
{{stdin}}
{{channel}}
{{variable}}
{{FileName}}
"raw string"

Targets:
{{stdout}}
{{channel}}
{{variable}}
{{FileName}}

set: versus set:: or Set:
add: versus add:: or Add:

Generally:
- channel and variable names expand variables
- raw strings are not expanded whatsoever
- value parameters get full substitution

### Command Line Interface

textforge command1: param1 ... command2: param1 ... ...

(shell handles string escapes)

### Script Command Format

command1: param1 ...
command2: param1 ...
...

(string escapes have to be parsed)

### WebUI:

WebUI would have 3 textboxes (commands atop, original left, processed right)
it would just post one json, and feed in output.

It posts a single JSON array to the HTTP service, something like
`[["add", "{{original}}"], ["run", "{{commands}}"], ["print"]]`
where `{{original}}` and `{{commands}}` are placeholders filled from the UI.
The response – the printed string – flows directly into the right-hand pane.