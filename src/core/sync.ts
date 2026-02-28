import { SyncNotConfiguredError } from "@/core/errors.ts";
import type { Repository, SyncResult } from "@/data/repository.ts";
import { isSyncableRepository } from "@/data/repository.ts";

export async function triggerSync(repo: Repository): Promise<SyncResult> {
  if (!isSyncableRepository(repo)) {
    throw new SyncNotConfiguredError();
  }
  return repo.sync();
}
