type StringCallback = (value: string) => void;

type StringProcessor = (value: string) => string;

type Dict<Type> = Record<string, Type>;

const ENCODING = "utf-8";

const CTTEXT = { "Content-Type": "text/plain" };
const CTJSON = { "Content-Type": "application/json" };