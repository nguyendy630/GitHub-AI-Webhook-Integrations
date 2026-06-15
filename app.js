import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN, // optional for public repos, recommended otherwise
});

async function getPRFiles(owner, repo, prNumber) {
	try {
		const response = await octokit.rest.pulls.listFiles({
			owner,
			repo,
			pull_number: Number(prNumber),
			per_page: 100,
		});

		const { data } = response;

		console.log("Files count:", data.length);
		console.log("PR files raw data:", JSON.stringify(data, null, 2));

		return data.map((file) => ({
			filename: file.filename,
			status: file.status,
			additions: file.additions,
			deletions: file.deletions,
			changes: file.changes,
			patch: file.patch,
			blobUrl: file.blob_url,
			rawUrl: file.raw_url,
			previousFilename: file.previous_filename,
		}));
	} catch (error) {
		console.error("Error fetching PR files:", error.status, error.message);
		console.error(error.response?.data);
		throw error;
	}
}

getPRFiles("nguyendy630", "AI_webhooks_test", 13) .then((files) => console.log("Mapped files:", files)) .catch(console.error);