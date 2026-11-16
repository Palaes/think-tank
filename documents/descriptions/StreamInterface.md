## Streaming to the UI

[[message role=role name=name time=milliseconds]] // UI inserts message block
content

[[image name=name]] // UI inserts image block
description

[[document name=name]] // UI inserts document block
description

[[message role=env name=name time=milliseconds]] // UI inserts result block
content

[[message role=info]] // UI inserts info block
content

## Message to the LLM

[[author=name date=date time=time]] // normal text message
content

[[image name=name]] // when image description loaded
description

[[document name=name]] // when document description loaded
description

[[author=env source=name date=date time=time]] // when result arrives
content

## UI Reads Stream Mechanism

- receives block
- does it end with `[`
	- concatenate next block
- does it containt `[[`
	- handle what is before
	- until it contains `]]`
		- concatenate next block
	- process the `[[meta]]` portion
	- keep the rest of the block
- continue processing normally

## Future Ideas

- store contexts in this format
- send data in this format
- keep thoughts in context