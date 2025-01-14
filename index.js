import { scrape as mercatorScrape } from "./lib/mercator.js";
import { scrape as sparScrape } from "./lib/spar.js";
import { scrape as tusScrape } from "./lib/tus.js";

(async () => {
	console.log("[INFO]: Starting scraping process...");

	// Spar has the largest selection of products, so it will be scraped first, ~12000
	console.log("[INFO]: Scraping Spar web store...");
	await sparScrape();

	// Mercator has ~5000 products, so it will be scraped second
	console.log("[INFO]: Scraping Mercator web store...");
	await mercatorScrape();

	// Tuš has the smallest selection of products, so it will be scraped last
	console.log("[INFO]: Scraping Tus web store...");
	await tusScrape();
})();