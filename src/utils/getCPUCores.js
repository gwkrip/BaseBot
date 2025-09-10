import os from "os";
import { execSync } from "child_process";

export function getCpuCores() {
  try {
    const cores = os.cpus()?.length;
    if (cores && cores > 0) return cores;
  } catch (_) {}

  try {
    const cores = parseInt(execSync("nproc --all").toString().trim(), 10);
    if (!isNaN(cores) && cores > 0) return cores;
  } catch (_) {}

  try {
    const cores = parseInt(
      execSync("wmic cpu get NumberOfCores /value")
        .toString()
        .match(/NumberOfCores=(\d+)/)[1],
      10
    );
    if (!isNaN(cores) && cores > 0) return cores;
  } catch (_) {}

  if (process.env.NUMBER_OF_PROCESSORS) {
    const cores = parseInt(process.env.NUMBER_OF_PROCESSORS, 10);
    if (!isNaN(cores) && cores > 0) return cores;
  }

  return 1;
}