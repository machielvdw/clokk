import { createContext, useContext } from "solid-js";
import type { Repository } from "@/data/repository.ts";

const RepoContext = createContext<Repository>();

export const RepoProvider = RepoContext.Provider;

export function useRepo(): Repository {
  const repo = useContext(RepoContext);
  if (!repo) {
    throw new Error("useRepo() called outside of RepoProvider");
  }
  return repo;
}
