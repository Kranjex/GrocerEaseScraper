import { spar } from "./stores.js";
import puppeteer from "puppeteer";
import dotenv from "dotenv";

Object.defineProperty(String.prototype, "capitalize", {
	value: function () {
		return this.charAt(0).toUpperCase() + this.slice(1);
	},
	enumerable: false,
});

dotenv.config();
export const scrape = async () => {
	const browser = await puppeteer.launch({
		executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
		headless: false,
	});
	const page = await browser.newPage();

	for (const category in spar) {
		if (!spar[category]) continue;

		let nextUrl = spar[category];
		console.log("[INFO]: Scraping category for URL:", nextUrl, ", category:", category);
		await page.goto(nextUrl, { waitUntil: "networkidle2" });

		await page.waitForSelector("div.spar-resultGrid", { timeout: 30000 });

		const content = await page.evaluate(() => {
			// const images = document.querySelectorAll("img.js-product-item__image");
			// images.forEach(img => {
			// 	if (img.dataset.src) {
			// 		img.src = img.dataset.src;
			// 	}
			// });

			const items = Array.from(document.querySelectorAll("div.spar-resultGrid div.spar-productBox"));
			return items.map(item => {
				const title = item.querySelector("div.spar-productBox__titleContainer a > div:first-of-type").textContent
					.toLowerCase();
				const imageURL = item.querySelector("div.spar-productBox__imgContainer a img").getAttribute("src");
				const priceInteger = item.querySelector("div.spar-productBox__price--priceInteger").textContent.trim();
				const priceDecimal = item.querySelector("div.spar-productBox__price--priceDecimal").textContent.trim();
				const price = parseFloat(priceInteger.concat(".", priceDecimal));

				return { title, imageURL, price };
			});
		});

		for (const item of content) {
			// console.log("Storing item in database:", item);
			const response = await fetch(process.env.API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title: item.title.capitalize(),
					imageURL: item.imageURL,
					price: item.price,
					discount: 0,
					category: category,
					store: "spar",
				}),
			});
			const data = await response.json();
			console.log(data);
		}

		console.log("[INFO]: Moving to the next page as Spar online store allows all articles to be listed on single page.");
		console.log("[INFO]: Finished processing all pages for URL:", spar[category], ", category:", category);
	}

	await browser.close();
};
