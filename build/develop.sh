errors() {
	grep -i "error"
}

tsc -w -p build/agora.server.json | errors &
tsc -w -p build/agora.web.json | errors &
tsc -w -p build/settings.web.json | errors &
tsc -w -p build/prisms.server.json | errors &
tsc -w -p build/prisms.web.json | errors &
tsc -w -p build/textforge.server.json | errors &
tsc -w -p build/textforge.web.json | errors &

ls server/agora.js | entr -r node server/agora.js --port 8091 > /dev/null &
ls server/prisms.js | entr -r node server/prisms.js --port 8092 > /dev/null &
ls server/textforge.js | entr -r node server/textforge.js --port 8093 > /dev/null &

wait