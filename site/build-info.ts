import composeFile from "../compose.yml?raw";

/** where the project lives; every link on the site is built from this. */
export const repo = "https://github.com/durocodes/mise";

export const rawBase = repo.replace("github.com", "raw.githubusercontent.com");

/** the compose file that ships with the repo, shown in the install steps. */
export const compose = composeFile.trimEnd();
