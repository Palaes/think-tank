/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/ServerUtil.ts" />
/// <reference path="../PrismsLibrary/ImageMetadata.ts" />
/// <reference path="../PrismsLibrary/GenMetadata.ts" />
/// <reference path="../Adapters/ImageGenService.ts" />
/// <reference path="../Adapters/ImageSRService.ts" />
/// <reference path="../Adapters/DTHTTPAdapter.ts" />
/// <reference path="../Language/STDPreprocessor.ts" />
/// <reference path="../PrismsWebUI/GenParam.ts" />
/// <reference path="../PrismsWebUI/ParamUtil.ts" />
/// <reference path="../PrismsWebUI/Catalogue.ts" />
/// <reference path="../PrismsWebUI/SDCommandEngine.ts" />
/// <reference path="./Types.ts" />
/// <reference path="./Constants.ts" />



// ============================================================================
// Configuration
// ============================================================================

// Parse command line arguments
let serverPort = DEFAULT_SERVER_PORT;
let targetPort = DEFAULT_TARGET_PORT;

for (let i = 0; i < process.argv.length; i++) {
	if (process.argv[i] === '--port' && i + 1 < process.argv.length) {
		serverPort = parseInt(process.argv[i + 1]) || DEFAULT_SERVER_PORT;
	}
	if (process.argv[i] === '--target-port' && i + 1 < process.argv.length) {
		targetPort = parseInt(process.argv[i + 1]) || DEFAULT_TARGET_PORT;
	}
}

// Paths
const serverPath = `./server`;
const webPath = `./web/prisms`;

const defaultsFilePath = `${serverPath}/${DEFAULTS_FILE}`;
const settingsFilePath = `${resultsPath}/${SETTINGS_FILE}`;

// Target URLs
const targetBaseURL = `http://127.0.0.1:${targetPort}`;

// ============================================================================
// File Operations
// ============================================================================

function initialize(): void {
	// Ensure results directory exists
	try {
		NodeUtil.makeDirSync(resultsPath, { recursive: true });
	} catch (e) {
		// Directory may already exist
	}

	// Copy defaults to settings if doesn't exist
	if (!NodeUtil.fs.existsSync(settingsFilePath)) {
		try {
			const defaults = NodeUtil.readFileSync(defaultsFilePath, ENCODING);
			NodeUtil.writeFileSync(settingsFilePath, defaults, ENCODING);
		} catch (e) {
			console.error('Failed to initialize settings:', e);
		}
	}
}

function getProjectPath(project: string): string {
	const path = `${resultsPath}/${project}`;
	if (!NodeUtil.fs.existsSync(path)) {
		NodeUtil.makeDirSync(path, { recursive: true });
	}
	return path;
}

function getHistoryFilePath(project: string): string {
	return `${getProjectPath(project)}/${HISTORY_FILE}`;
}

function getQueueFilePath(): string {
	return `${resultsPath}/${QUEUE_FILE}`;
}

function getImageFilePath(project: string, ID: number): string {
	return `${getProjectPath(project)}/${formatImageFileName(ID)}`;
}

function formatImageFileName(ID: number): string {
	return `${formatImageIndex(ID, IMAGE_DIGITS)}${IMAGE_SUFFIX}`;
}

function getSourceFilePath(sourceImage: string): string {
	return `${resultsPath}/${sourceImage}`;
}

// The name the entry's image actually has on disk, null while it has none.
function getImageFileName(entry: ServerGenData): string {
	if (entry.imageName) {
		return entry.imageName.split('?')[0];
	}
	return null;
}

// Move the image of one catalogue entry into another project.
// The entry's image name decides what is moved, the ID only decides the new name.
function moveImage(source: string, entry: ServerGenData, target: string, targetID: number): boolean {
	const fileName = getImageFileName(entry);
	if (fileName == null) {
		return false;
	}
	return renameImageFile(source, fileName, target, formatImageFileName(targetID));
}

// Rename one image file, false when the source is missing or the target is taken.
function renameImageFile(fromProject: string, fromName: string, toProject: string, toName: string): boolean {
	const sourcePath = `${getProjectPath(fromProject)}/${fromName}`;
	const targetPath = `${getProjectPath(toProject)}/${toName}`;
	if (!NodeUtil.fs.existsSync(sourcePath)) {
		return false;
	}
	if (NodeUtil.fs.existsSync(targetPath)) {
		return false;
	}
	try {
		NodeUtil.fs.renameSync(sourcePath, targetPath);
	} catch (e) {
		return false;
	}
	return NodeUtil.fs.existsSync(targetPath);
}

function formatImageIndex(index: number, digits: number): string {
	let result = index.toString();
	while (result.length < digits) {
		result = '0' + result;
	}
	return result;
}

function formatImageName(ID: number): string {
	return `${formatImageIndex(ID, IMAGE_DIGITS)}${IMAGE_SUFFIX}?${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
}

async function listUpscalers(): Promise<string[]> {
	return ImageSRService.listModels({
		APIType: "resrgan",
		APIHost: "",
		APITool: ESRGAN_PATH,
		modelsPath: ESRGAN_MODELS_PATH
	});
}

function readHistory(path: string): ServerGenData[] {
	if (NodeUtil.fs.existsSync(path)) {
		return FileUtil.readJSONSync(path) ?? [];
	}
	return [];
}

function loadHistory(project: string): ServerGenData[] {
	return readHistory(getHistoryFilePath(project));
}

// One entry per line, so the history stays readable and diffable.
function writeHistory(path: string, history: ServerGenData[]): void {
	const lines = [ "[" ];
	for (let i = 0; i < history.length; ++i) {
		const line = "\t" + flattenJSON(history[i]);
		if (i < history.length - 1) {
			lines.push(`${line},`);
		} else {
			lines.push(line);
		}
	}
	lines.push("]");
	FileUtil.writeTextSync(path, lines.join("\n"));
}

// Pretty printed JSON folded back onto a single line.
function flattenJSON(value: any): string {
	const lines = JSON.stringify(value, null, "\t").split("\n");
	return lines.map(line => line.trim()).join(" ");
}

function saveHistory(project: string, history: ServerGenData[]): void {
	writeHistory(getHistoryFilePath(project), history);
}

function readQueue(): GenJob[] {
	const path = getQueueFilePath();
	if (NodeUtil.fs.existsSync(path)) {
		return FileUtil.readJSONSync(path) ?? [];
	}
	return [];
}

function findProjects(path: string, prefix: string, result: string[]): void {
	let entries = [];
	try {
		entries = NodeUtil.fs.readdirSync(path, { withFileTypes: true });
	} catch (e) {
		return;
	}
	for (const entry of entries) {
		if (entry.isDirectory()) {
			const childPath = `${path}/${entry.name}`;
			const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (NodeUtil.fs.existsSync(`${childPath}/${HISTORY_FILE}`)) {
				result.push(childPrefix);
			}
			findProjects(childPath, childPrefix, result);
		}
	}
}

// The smallest index that neither the catalogue nor the project directory is using.
function getNextID(project: string, history: ServerGenData[]): number {
	const used = new Set<number>();
	for (const entry of history) {
		used.add(entry.ID);
	}
	for (const fileName of readFileNames(project)) {
		const index = parseImageIndex(fileName);
		if (index) {
			used.add(index);
		}
	}
	let result = 1;
	while (used.has(result)) {
		++result;
	}
	return result;
}

function readFileNames(project: string): string[] {
	try {
		return NodeUtil.readDirSync(getProjectPath(project));
	} catch (e) {
		return [];
	}
}

// The index a file name carries, 0 when it carries none.
function parseImageIndex(fileName: string): number {
	if (!fileName.endsWith(IMAGE_SUFFIX)) {
		return 0;
	}
	const match = fileName.match(/^(\d+)\./);
	if (match) {
		return parseInt(match[1]);
	}
	return 0;
}

function findGen(history: ServerGenData[], ID: number): ServerGenData {
	for (const item of history) {
		if (item.ID == ID) {
			return item;
		}
	}
	return null;
}

// Append a pending image to the project catalogue, under the file lock.
async function appendGen(project: string, taskData: TaskData): Promise<ServerGenData> {
	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	try {
		const history = readHistory(path);
		const entry: ServerGenData = { ID: getNextID(project, history), status: "pending", taskData };
		history.push(entry);
		writeHistory(path, history);
		return entry;
	} finally {
		lock.release();
	}
}

// Edit one catalogue item by ID, under the file lock.
async function updateGen(project: string, ID: number, patch: Partial<ServerGenData>): Promise<void> {
	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	try {
		const history = readHistory(path);
		const entry = findGen(history, ID);
		if (entry) {
			Object.assign(entry, patch);
			writeHistory(path, history);
		}
	} finally {
		lock.release();
	}
}

// Drop one catalogue item by ID, under the file lock.
async function removeGen(project: string, ID: number): Promise<void> {
	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	try {
		const history = readHistory(path);
		writeHistory(path, history.filter(item => item.ID != ID));
	} finally {
		lock.release();
	}
}

// Append a job to the global queue, under the file lock.
async function appendJob(job: GenJob): Promise<void> {
	const path = getQueueFilePath();
	const lock = await FileUtil.lock(path);
	try {
		const queue = readQueue();
		queue.push(job);
		FileUtil.writeJSONSync(path, queue);
	} finally {
		lock.release();
	}
}

// Append a batch of pending images to the project catalogue, under one lock.
async function appendGens(project: string, taskDatas: TaskData[]): Promise<ServerGenData[]> {
	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	try {
		const history = readHistory(path);
		const result: ServerGenData[] = [];
		for (const taskData of taskDatas) {
			const entry: ServerGenData = { ID: getNextID(project, history), status: 'pending', taskData };
			history.push(entry);
			result.push(entry);
		}
		writeHistory(path, history);
		return result;
	} finally {
		lock.release();
	}
}

// Append a batch of jobs to the global queue, under one lock.
async function appendJobs(jobs: GenJob[]): Promise<void> {
	const path = getQueueFilePath();
	const lock = await FileUtil.lock(path);
	try {
		const queue = readQueue();
		queue.push(...jobs);
		FileUtil.writeJSONSync(path, queue);
	} finally {
		lock.release();
	}
}

// Drop every queued job the predicate rejects, under the file lock.
async function removeJobs(keep: (job: GenJob) => boolean): Promise<void> {
	const path = getQueueFilePath();
	const lock = await FileUtil.lock(path);
	try {
		FileUtil.writeJSONSync(path, readQueue().filter(keep));
	} finally {
		lock.release();
	}
}

// Repoint queued jobs from a renamed project.
async function renameJobs(from: string, to: string): Promise<void> {
	const path = getQueueFilePath();
	const lock = await FileUtil.lock(path);
	try {
		const queue = readQueue();
		for (const job of queue) {
			if (job.project == from) {
				job.project = to;
			}
		}
		FileUtil.writeJSONSync(path, queue);
	} finally {
		lock.release();
	}
}

function saveImage(project: string, ID: number, base64Data: string): string {
	const buffer = Buffer.from(base64Data, 'base64');
	const path = getImageFilePath(project, ID);
	NodeUtil.writeFileSync(path, buffer);
	// Return image name with cache buster
	return formatImageName(ID);
}

// Remove the image a generation wrote under this ID.
function removeImage(project: string, ID: number): void {
	try {
		NodeUtil.removeSync(getImageFilePath(project, ID));
	} catch (e) {
		// File may not exist
	}
}

// Remove the image a catalogue entry refers to, whatever index it sits at.
function removeEntryImage(project: string, entry: ServerGenData): void {
	const fileName = getImageFileName(entry);
	if (fileName == null) {
		return;
	}
	try {
		NodeUtil.removeSync(`${getProjectPath(project)}/${fileName}`);
	} catch (e) {
		// File may not exist
	}
}

// Rewrite the generation metadata stored inside the image of an entry.
function writeImageMetadata(project: string, entry: ServerGenData): void {
	const fileName = getImageFileName(entry);
	if (fileName == null) {
		return;
	}
	const path = `${getProjectPath(project)}/${fileName}`;
	try {
		const data = NodeUtil.fs.readFileSync(path);
		const description = GenMetadata.describeImage(entry.taskData);
		const updated = ImageMetadataUtil.write(data, description, GenMetadata.toJSON(entry.taskData));
		if (updated) {
			NodeUtil.fs.writeFileSync(path, updated);
		}
	} catch (e) {
		console.warn(`unable to write the metadata of ${path}`);
	}
}

function readMetadata(base64Data: string): ExtractedImageMetadata {
	try {
		const buffer = Buffer.from(base64Data, 'base64');
		return ImageMetadataUtil.extract(buffer, data => NodeUtil.zlib.inflateSync(data));
	} catch {
		return {};
	}
}

function extractSeedFromImage(base64Data: string): number | null {
	try {
		const metadata = readMetadata(base64Data);
		if (metadata.seed !== undefined) {
			return metadata.seed;
		}
		const buffer = Buffer.from(base64Data, 'base64');
		const str = buffer.toString('binary');
		const match = str.match(/"seed":\s*(\d+)/);
		if (match) {
			return parseInt(match[1]);
		}
	} catch (e) {
		// Ignore extraction errors
	}
	return null;
}


function getProject(requestData: any): string {
	return requestData?.project || 'main';
}

// ============================================================================
// Prompt Unrolling
// ============================================================================

// Read the settings, falling back to the defaults file.
function readSettings(): any {
	try {
		return JSON.parse(NodeUtil.readFileSync(settingsFilePath, ENCODING));
	} catch (e) {
		try {
			return JSON.parse(NodeUtil.readFileSync(defaultsFilePath, ENCODING));
		} catch (e2) {
			return {};
		}
	}
}

// Flatten the settings categories into the lookup map the command engine uses.
function createCatalogue(name: string, categories: any, CatalogueType: any): any {
	const map: any = { disabled: null };
	if (categories) {
		const values: any[] = Object.values(categories);
		for (const category of values) {
			for (const key in category) {
				map[key.replace(/[\s:+]+/g, '-')] = category[key];
			}
		}
	}
	return new CatalogueType(name, map);
}

// Build a fresh engine over the catalogues in the current settings.
function createGenerationEngine(): { engine: SDCommandEngine, preprocessor: STDPreprocessor } {
	const settings = readSettings();
	modelCatalogue = createCatalogue('models', settings.models, CKPTCatalogue);
	loraCatalogue = createCatalogue('LoRAs', settings.LoRAs, CKPTCatalogue);
	controlCatalogue = createCatalogue('controls', settings.controls, CKPTCatalogue);
	samplerCatalogue = createCatalogue('samplers', settings.samplers, SimpleCatalogue);
	return { engine: new SDCommandEngine(), preprocessor: new STDPreprocessor() };
}

function substituteSource(input: string, source: TaskSource): string {
	const positive = source ? source.positivePrompt : '';
	const negative = source ? source.negativePrompt : '';
	let result = input.split('{@source-prompt}').join(positive);
	result = result.split('{@source-negative}').join(negative);
	return result;
}

function hasPositiveText(block: string): boolean {
	for (const line of block.split(/\n+/)) {
		const text = line.trim();
		if (text == '' || text.startsWith('/') || text.startsWith('-')) {
			continue;
		}
		return true;
	}
	return false;
}

function splitGenerationBlocks(input: string): string[] {
	const result: string[] = [];
	for (const block of input.split(/\n\s*\n/)) {
		if (block.trim() == '') {
			continue;
		}
		if (hasPositiveText(block) || result.length == 0) {
			result.push(block);
		} else {
			result[result.length - 1] += '\n' + block;
		}
	}
	return result;
}

function unrollGeneration(result: GenParam[], engine: SDCommandEngine, preprocessor: STDPreprocessor, taskData: GenParam, input: string, seed: number): number {
	const count = taskData.batchCount || 1;
	for (let i = 0; i < count; ++i) {
		taskData.seed = seed;
		taskData.batchCount = 1;
		const tasks: GenParam[] = [];
		engine.init(taskData, submitted => tasks.push(submitted));
		preprocessor.init(seed, block => engine.handleBlock(block));
		for (const block of splitGenerationBlocks(input)) {
			preprocessor.handleBlock(block);
		}
		for (const task of tasks) {
			result.push(task);
		}
		seed = XSRandom.next(seed);
	}
	return seed;
}

// Expand the selection, the dynamic prompt, and the batch count into the
// catalogue entries the queue will run, in submission order.
function unrollGenerations(baseData: GenParam, input: string, sources: TaskSource[]): { tasks: GenParam[], seed: number } {
	const result: GenParam[] = [];
	if (sources.length == 0) {
		sources.push(null);
	}
	const { engine, preprocessor } = createGenerationEngine();
	let seed = baseData.seed;
	for (const source of sources) {
		const taskData = ParamUtil.duplicateSDGen(baseData);
		if (source) {
			taskData.sourceImage = source.path;
			engine.matchAspect(taskData, source.width > source.height ? 'horizontal' : 'vertical');
		} else {
			taskData.strength = 1;
		}
		seed = unrollGeneration(result, engine, preprocessor, taskData, substituteSource(input, source), seed);
	}
	return { tasks: result, seed };
}

// The server stores the flattened Draw Things parameters plus the job type.
function toServerTask(task: GenParam): TaskData {
	const result: TaskData = { ...ParamUtil.toDTHGen(task) };
	result.sourceImage = task.sourceImage;
	result.type = task.type;
	result.upscaleModel = task.upscaleModel;
	return result;
}

// ============================================================================
// Route Handlers
// ============================================================================

// ============================================================================
// Generation Queue
// ============================================================================

// Only one queue runner is active at a time, the flag is per server process.
let queueRunning = false;

// Cancellation hooks for in-flight jobs, keyed by project and ID.
const activeAborts = new Map<string, () => void>();

// The latest percentage an in-flight job reported, keyed by project and ID.
const activeProgress = new Map<string, number>();

function jobKey(project: string, ID: number): string {
	return `${project}/${ID}`;
}

function getGenerationSettings(): { mode: string, modsFolder: string, tool: string } {
	const result = { mode: 'CLI', modsFolder: DRAWTHINGS_MODELS_PATH, tool: 'draw-things-cli' };
	try {
		const content = NodeUtil.readFileSync(settingsFilePath, ENCODING);
		const settings = JSON.parse(content);
		result.mode = settings.generationMode || result.mode;
		result.tool = settings.drawThingsTool || result.tool;
	} catch (e) {
		// TODO: Handle error.
	}
	return result;
}

// Run the RealESRGAN upscaler for an entry's source image.
async function upscaleImage(taskData: TaskData, outputPath: string): Promise<string> {
	const params: ImageSRParams = {
		APIType: "resrgan",
		APIHost: "",
		APITool: ESRGAN_PATH,
		modelsPath: ESRGAN_MODELS_PATH,
		model: taskData.upscaleModel
	};
	return ImageSRService.upscale(params, getSourceFilePath(taskData.sourceImage), outputPath);
}

// Generate one image for a catalogue entry, returning the fields to fold back in.
async function generateImage(project: string, ID: number, taskData: TaskData, signal?: AbortSignal, onProgress?: ProgressHandler): Promise<Partial<ServerGenData>> {
	const startTime = Date.now();
	const settings = getGenerationSettings();
	const outputPath = getImageFilePath(project, ID);

	let imageBase64: string;
	if (taskData.type === 'upscale') {
		console.log('Upscaling...');
		imageBase64 = await upscaleImage(taskData, outputPath);
	} else {
		const params: ImageGenParams = {
			...DTHTTPAdapter.convertFrom(taskData),
			APIType: settings.mode === 'HTTP' ? 'dthttp' : 'dtcli',
			APIHost: targetBaseURL,
			APITool: settings.tool,
			modelsFolder: settings.modsFolder,
			inputMode: taskData.sourceImage ? 'path' : 'raw',
			inputImage: taskData.sourceImage ? getSourceFilePath(taskData.sourceImage) : null
		};
		console.log(settings.mode === 'HTTP' ? 'Generating via HTTP API...' : 'Generating via CLI...');
		imageBase64 = await ImageGenService.generate(params, outputPath, signal, onProgress);
		if (settings.mode === 'HTTP') {
			saveImage(project, ID, imageBase64);
		}
	}

	if (!NodeUtil.fs.existsSync(outputPath)) {
		throw new Error(`Generated image not found at ${outputPath}`);
	}

	const genTime = Date.now() - startTime;
	const imageName = formatImageName(ID);
	const extractedSeed = extractSeedFromImage(imageBase64);
	const resultTaskData: TaskData = { ...taskData };
	if (extractedSeed !== null) {
		resultTaskData.seed = extractedSeed;
	}

	return { imageName, taskData: resultTaskData, genTime };
}

async function executeJob(job: GenJob): Promise<void> {
	console.log(`Starting job ${job.ID} for project ${job.project}`);
	// Register a cancellation hook so a removal request can abort this job
	const controller = new AbortController();
	const key = jobKey(job.project, job.ID);
	activeAborts.set(key, () => controller.abort());
	activeProgress.set(key, 0);
	// Set the catalogue item to ongoing before generating
	await updateGen(job.project, job.ID, { status: 'ongoing', startedDate: Date.now() });
	try {
		const patch = await generateImage(job.project, job.ID, job.taskData, controller.signal, percentage => activeProgress.set(key, percentage));
		if (controller.signal.aborted) {
			// The job was removed while generating, discard any output
			removeImage(job.project, job.ID);
			return;
		}
		// Edit the catalogue with the final result
		GenMetadata.normalize(patch.taskData);
		const entry: ServerGenData = {
			ID: job.ID,
			status: 'done',
			imageName: patch.imageName,
			taskData: patch.taskData,
			genTime: patch.genTime
		};
		await updateGen(job.project, job.ID, entry);
		writeImageMetadata(job.project, entry);
		console.log(`Finished job ${job.ID} for project ${job.project}`);
	} catch (error) {
		if (controller.signal.aborted) {
			// The job was removed while generating, discard any output
			removeImage(job.project, job.ID);
			console.log(`Aborted job ${job.ID} for project ${job.project}`);
			return;
		}
		console.error(`Job ${job.ID} for project ${job.project} failed:`, error);
		// The job failed, discard any partial output
		removeImage(job.project, job.ID);
		await updateGen(job.project, job.ID, { status: 'error' });
	} finally {
		activeAborts.delete(key);
		activeProgress.delete(key);
	}
}

// Drain the queue, guarded so only one runner is active at a time.
async function executeQueue(): Promise<void> {
	if (queueRunning) {
		return;
	}
	queueRunning = true;
	const path = getQueueFilePath();
	try {
		while (true) {
			const lock = await FileUtil.lock(path);
			let job: GenJob = null;
			try {
				const queue = readQueue();
				if (queue.length == 0) {
					// clear the flag while holding the lock, so a concurrent enqueue
					// either lands before this check or wakes a fresh runner
					queueRunning = false;
					return;
				}
				// take the head job off the queue
				job = queue.shift();
				FileUtil.writeJSONSync(path, queue);
			} finally {
				lock.release();
			}
			await executeJob(job);
		}
	} catch (error) {
		queueRunning = false;
		throw error;
	}
}

async function handleGenerate(requestData: any, response: any): Promise<any> {
	// Safety check: parse JSON if requestData is still a string
	if (typeof requestData === 'string') {
		try {
			requestData = JSON.parse(requestData);
		} catch (e) {
			throw new Error('Invalid JSON in request body: ' + e);
		}
	}

	if (requestData.taskData) {
		return handleBatchedGenerate(requestData);
	}

	const project = getProject(requestData);

	// Create a copy without the 'project' field for Draw Things API
	const cleanRequestData = { ...requestData };
	delete (cleanRequestData as any).project;

	// Add a pending image to the project catalogue, then queue the job
	const entry = await appendGen(project, cleanRequestData);
	await appendJob({ project, ID: entry.ID, taskData: cleanRequestData });

	// Start executing jobs if not already running
	executeQueue().catch(error => console.error('Queue execution failed:', error));

	return entry;
}

// Unroll the selection, prompt, and batch count into pending catalogue entries.
async function handleBatchedGenerate(requestData: any): Promise<any> {
	const project = getProject(requestData);
	const baseData: GenParam = requestData.taskData || {};
	const input = cleanString(requestData.combinedPrompt ?? baseData.combinedPrompt ?? '');
	delete baseData.combinedPrompt;
	const sources: TaskSource[] = requestData.sources || [];
	const unrolled = unrollGenerations(baseData, input, sources);
	const entries = await appendGens(project, unrolled.tasks.map(toServerTask));
	await appendJobs(entries.map(entry => ({ project, ID: entry.ID, taskData: entry.taskData })));
	executeQueue().catch(error => console.error('Queue execution failed:', error));
	return { entries, seed: unrolled.seed };
}

// Report the progress of the requested catalogue entries.
async function handleGetTaskStates(requestData: any, response: any): Promise<TaskState[]> {
	const project = getProject(requestData);
	const IDs: number[] = requestData.IDs || [];
	const history = loadHistory(project);
	const result: TaskState[] = [];
	for (const ID of IDs) {
		const entry = findGen(history, ID);
		if (entry == null) {
			continue;
		}
		const seconds = entry.status == 'ongoing' && entry.startedDate ? Math.floor((Date.now() - entry.startedDate) / 1000) : 0;
		let percentage = Math.round(activeProgress.get(jobKey(project, ID)) ?? 0);
		if (entry.status == 'done') {
			percentage = 100;
		}
		result.push({
			ID,
			status: entry.status,
			seconds,
			percentage,
			imageName: entry.imageName,
			genTime: entry.genTime
		});
	}
	return result;
}

async function handleGetHistory(requestData: any, response: any): Promise<ServerGenData[]> {
	const project = getProject(requestData);
	return loadHistory(project);
}

async function handleGetProjects(requestData: any, response: any): Promise<string[]> {
	const result: string[] = [];
	findProjects(resultsPath, "", result);
	result.sort();
	return result;
}

// Create a project and move the given catalogue items into it.
async function handleCreateProject(requestData: any, response: any): Promise<any> {
	const name = requestData.name;
	const source = requestData.sourceProject || 'main';
	const IDs: number[] = requestData.IDs || [];

	if (!name) {
		throw new Error('name is required');
	}

	const sourcePath = getHistoryFilePath(source);
	const targetPath = getHistoryFilePath(name);
	if (sourcePath == targetPath) {
		return { success: true };
	}

	// Hold both histories while the images move, so a partial run is not visible
	const sourceLock = await FileUtil.lock(sourcePath);
	try {
		const targetLock = await FileUtil.lock(targetPath);
		try {
			const history = readHistory(sourcePath);
			const targetHistory = readHistory(targetPath);
			const kept: ServerGenData[] = [];
			const skipped: number[] = [];
			let movedCount = 0;
			for (const entry of history) {
				if (IDs.includes(entry.ID)) {
					// The entry only leaves the source once its image is in the target
					const newID = getNextID(name, targetHistory);
					if (moveImage(source, entry, name, newID)) {
						++movedCount;
						targetHistory.push({
							...entry,
							ID: newID,
							imageName: formatImageName(newID)
						});
						continue;
					}
					skipped.push(entry.ID);
				}
				kept.push(entry);
			}
			if (movedCount) {
				writeHistory(targetPath, targetHistory);
				writeHistory(sourcePath, kept);
			}
			if (skipped.length) {
				console.warn(`unable to move ${skipped.length} image(s) to ${name}:`, skipped);
			}
		} finally {
			targetLock.release();
		}
	} finally {
		sourceLock.release();
	}

	return { success: true };
}

// Rename the images to a dense sequence and rewrite every entry with it.
async function handleReindexProject(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	try {
		const history = readHistory(path);
		// move every image aside first, so a new index cannot land on a used name
		const images = new Map<ServerGenData, { name: string, temp: string }>();
		for (const entry of history) {
			const name = getImageFileName(entry);
			if (name == null) {
				continue;
			}
			const temp = `${name}.reindex`;
			if (renameImageFile(project, name, project, temp)) {
				images.set(entry, { name, temp });
			} else if (!NodeUtil.fs.existsSync(`${getProjectPath(project)}/${name}`)) {
				// the entry points at an image that is not there
				entry.imageName = null;
			}
		}
		// then give every entry its place in the sequence and land its image there
		for (let i = 0; i < history.length; ++i) {
			const entry = history[i];
			const index = i + 1;
			const image = images.get(entry);
			if (image == null) {
				entry.ID = index;
				continue;
			}
			if (renameImageFile(project, image.temp, project, formatImageFileName(index))) {
				entry.ID = index;
				entry.imageName = formatImageName(index);
			} else {
				renameImageFile(project, image.temp, project, image.name);
			}
		}
		for (const entry of history) {
			GenMetadata.normalize(entry.taskData);
			writeImageMetadata(project, entry);
		}
		writeHistory(path, history);
	} finally {
		lock.release();
	}

	return { success: true };
}

// Replace the parameters of the given entries and of their images.
async function handleAssignParams(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const IDs: number[] = requestData.IDs || [];
	const taskData: TaskData = requestData.taskData || {};
	const keepPrompts = IDs.length > 1;
	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	try {
		const history = readHistory(path);
		for (const entry of history) {
			if (IDs.includes(entry.ID)) {
				const previous = entry.taskData;
				entry.taskData = { ...taskData };
				if (keepPrompts) {
					entry.taskData.prompt = previous.prompt;
					entry.taskData.negative_prompt = previous.negative_prompt;
					entry.taskData.seed = previous.seed;
				}
				GenMetadata.normalize(entry.taskData);
				writeImageMetadata(project, entry);
			}
		}
		writeHistory(path, history);
	} finally {
		lock.release();
	}

	return { success: true };
}

// Rename the project directory, keeping queued jobs pointing at it.
async function handleRenameProject(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const name = requestData.name;

	if (!name) {
		throw new Error('name is required');
	}

	const sourcePath = getProjectPath(project);
	const targetPath = `${resultsPath}/${name}`;
	if (sourcePath == targetPath) {
		return { success: true };
	}
	if (NodeUtil.fs.existsSync(targetPath)) {
		throw new Error('a project with that name already exists');
	}

	NodeUtil.fs.renameSync(sourcePath, targetPath);
	await renameJobs(project, name);

	return { success: true };
}

async function handleUpscalers(requestData: any, response: any): Promise<string[]> {
	return listUpscalers();
}

// Import uploaded images as finished catalogue entries.
async function handleImportImages(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const images: any[] = requestData.images || [];
	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	const entries: ServerGenData[] = [];
	try {
		const history = readHistory(path);
		for (const image of images) {
			const base64 = image.data.includes(',') ? image.data.split(',')[1] : image.data;
			const ID = getNextID(project, history);
			const metadata = ImageMetadataUtil.merge(readMetadata(base64), image.metadata || {});
			// the pixels decide the size, the metadata may hold the requested one
			const width = image.width || metadata.width || 512;
			const height = image.height || metadata.height || 512;
			saveImage(project, ID, base64);
			const taskData: TaskData = {
				prompt: metadata.positivePrompt || '',
				negative_prompt: metadata.negativePrompt || '',
				seed: metadata.seed ?? 0,
				width,
				height
			};
			if (metadata.model) {
				taskData.model = metadata.model;
			}
			if (metadata.sampler) {
				taskData.sampler = metadata.sampler;
			}
			if (metadata.steps !== undefined) {
				taskData.steps = metadata.steps;
			}
			if (metadata.guidanceScale !== undefined) {
				taskData.guidance_scale = metadata.guidanceScale;
			}
			if (metadata.shift !== undefined) {
				taskData.shift = metadata.shift;
			}
			if (metadata.strength !== undefined) {
				taskData.strength = metadata.strength;
			}
			if (metadata.seedMode) {
				taskData.seed_mode = metadata.seedMode;
			}
			if (metadata.maskBlur !== undefined) {
				taskData.mask_blur = metadata.maskBlur;
			}
			if (metadata.originalWidth != null) {
				taskData.original_width = metadata.originalWidth;
				taskData.original_height = metadata.originalHeight;
			}
			if (metadata.targetWidth != null) {
				taskData.target_width = metadata.targetWidth;
				taskData.target_height = metadata.targetHeight;
			}
			if (metadata.negativeOriginalWidth != null) {
				taskData.negative_original_width = metadata.negativeOriginalWidth;
				taskData.negative_original_height = metadata.negativeOriginalHeight;
			}
			const entry: ServerGenData = {
				ID,
				status: 'done',
				imageName: formatImageName(ID),
				taskData,
				genTime: 0
			};
			GenMetadata.normalize(entry.taskData);
			writeImageMetadata(project, entry);
			history.push(entry);
			entries.push(entry);
		}
		writeHistory(path, history);
	} finally {
		lock.release();
	}
	return { entries };
}

async function handleMoveGenPrev(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const ID = requestData.ID;

	if (typeof ID !== 'number') {
		throw new Error('ID is required');
	}

	const history = loadHistory(project);
	for (let i = 1; i < history.length; i++) {
		if (history[i].ID === ID) {
			// Swap with previous item
			const temp = history[i];
			history[i] = history[i - 1];
			history[i - 1] = temp;
			saveHistory(project, history);
			break;
		}
	}

	return { success: true };
}

async function handleMoveGenNext(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const ID = requestData.ID;

	if (typeof ID !== 'number') {
		throw new Error('ID is required');
	}

	const history = loadHistory(project);
	for (let i = 0; i < history.length - 1; i++) {
		if (history[i].ID === ID) {
			// Swap with next item
			const temp = history[i];
			history[i] = history[i + 1];
			history[i + 1] = temp;
			saveHistory(project, history);
			break;
		}
	}

	return { success: true };
}

// Move every selected entry by the same number of steps. Selections are moved
// in the direction of travel, never cross each other, and stop at the edge.
function moveEntries(history: ServerGenData[], IDs: number[], movement: string, steps: number): void {
	const selected = new Set(IDs);
	if (movement == 'next') {
		// the end of the history is the newest item, the UI's left
		for (let i = history.length - 1; i >= 0; --i) {
			if (selected.has(history[i].ID) == false) {
				continue;
			}
			let index = i;
			let count = 0;
			while (count < steps && index < history.length - 1 && selected.has(history[index + 1].ID) == false) {
				const temp = history[index];
				history[index] = history[index + 1];
				history[index + 1] = temp;
				++index;
				++count;
			}
		}
	} else {
		// the start of the history is the oldest item, the UI's right
		for (let i = 0; i < history.length; ++i) {
			if (selected.has(history[i].ID) == false) {
				continue;
			}
			let index = i;
			let count = 0;
			while (count < steps && index > 0 && selected.has(history[index - 1].ID) == false) {
				const temp = history[index];
				history[index] = history[index - 1];
				history[index - 1] = temp;
				--index;
				++count;
			}
		}
	}
}

async function handleMoveGens(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const IDs: number[] = requestData.IDs || [];
	const movement = requestData.movement == 'next' ? 'next' : 'prev';
	const steps = requestData.steps || 1;
	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	try {
		const history = readHistory(path);
		moveEntries(history, IDs, movement, steps);
		writeHistory(path, history);
	} finally {
		lock.release();
	}
	return { success: true };
}

async function handleRemoveGen(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const ID = requestData.ID;

	if (typeof ID !== 'number') {
		throw new Error('ID is required');
	}

	// Abort the generation if it is currently running
	const abort = activeAborts.get(jobKey(project, ID));
	if (abort) {
		abort();
	}

	// Remove image file
	const entry = findGen(loadHistory(project), ID);
	if (entry) {
		removeEntryImage(project, entry);
	}

	// Remove from history and from the queue
	await removeGen(project, ID);
	await removeJobs(job => job.project != project || job.ID != ID);

	return { success: true };
}

async function handleRemoveGens(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const IDs: number[] = requestData.IDs || [];
	const selected = new Set(IDs);

	// Abort any generation that is currently running
	for (const ID of IDs) {
		const abort = activeAborts.get(jobKey(project, ID));
		if (abort) {
			abort();
		}
	}

	const path = getHistoryFilePath(project);
	const lock = await FileUtil.lock(path);
	try {
		const history = readHistory(path);
		for (const entry of history) {
			if (selected.has(entry.ID)) {
				removeEntryImage(project, entry);
			}
		}
		writeHistory(path, history.filter(entry => selected.has(entry.ID) == false));
	} finally {
		lock.release();
	}

	await removeJobs(job => job.project != project || selected.has(job.ID) == false);

	return { success: true };
}

async function handleClearHistory(requestData: any, response: any): Promise<any> {
	const project = getProject(requestData);
	const history = loadHistory(project);

	// Remove all image files
	for (const item of history) {
		removeEntryImage(project, item);
	}

	// Remove history file
	try {
		NodeUtil.removeSync(getHistoryFilePath(project));
	} catch (e) {
		// File may not exist
	}

	// Drop this project's queued jobs
	await removeJobs(job => job.project != project);

	return { success: true };
}

async function handleSettings(requestData: any, response: any): Promise<SettingsData> {
	return readSettings();
}

async function handlePresets(requestData: any, response: any): Promise<any> {
	const lock = await FileUtil.lock(settingsFilePath);
	try {
		const settings = FileUtil.readJSONSync(settingsFilePath) || {};
		const presets = settings.presets || {};
		let changed = false;
		for (const name in requestData) {
			presets[name] = requestData[name];
			changed = true;
		}
		if (changed) {
			settings.presets = presets;
			FileUtil.writeJSONSync(settingsFilePath, settings);
		}
		return presets;
	} finally {
		lock.release();
	}
}

// ============================================================================
// Server Setup
// ============================================================================

initialize();

// Resume any jobs a previous run left in the queue

executeQueue().catch(error => console.error('Queue execution failed:', error));

startServer(
	serverPort,
	{ route: "/api/generate", handler: handleGenerate },
	{ route: "/api/get-history", handler: handleGetHistory },
	{ route: "/api/get-task-states", handler: handleGetTaskStates },
	{ route: "/api/get-projects", handler: handleGetProjects },
	{ route: "/api/create-project", handler: handleCreateProject },
	{ route: "/api/reindex-project", handler: handleReindexProject },
	{ route: "/api/rename-project", handler: handleRenameProject },
	{ route: "/api/assign-params", handler: handleAssignParams },
	{ route: "/api/upscalers", handler: handleUpscalers },
	{ route: "/api/import", handler: handleImportImages },
	{ route: "/api/move-gen-prev", handler: handleMoveGenPrev },
	{ route: "/api/move-gen-next", handler: handleMoveGenNext },
	{ route: "/api/move-gens", handler: handleMoveGens },
	{ route: "/api/remove-gen", handler: handleRemoveGen },
	{ route: "/api/remove-gens", handler: handleRemoveGens },
	{ route: "/api/clear-history", handler: handleClearHistory },
	{ route: "/api/settings", handler: handleSettings },
	{ route: "/api/presets", handler: handlePresets },
	{ route: "/ui/results", dir: resultsPath + "/" },
	{ route: "/ui/", dir: `./web/prisms-ui/` }
);