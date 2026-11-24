import composeFile from "../compose.yml?raw";

export const repo = "https://github.com/durocodes/mise";

export const rawBase = repo.replace("github.com", "raw.githubusercontent.com");

export const compose = composeFile.trimEnd();
