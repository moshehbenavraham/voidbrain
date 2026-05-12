import { planFrameworkUpdatePreview } from "../src/agent/framework-update-preview";

const candidatePaths = process.argv.slice(2);
const plan = planFrameworkUpdatePreview({
	rootDir: process.cwd(),
	candidatePaths,
});

console.log(JSON.stringify(plan, null, 2));

if (plan.issues.length > 0) {
	process.exitCode = 1;
}
