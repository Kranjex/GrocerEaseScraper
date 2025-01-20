import { mercator } from "./stores.js";
import puppeteer from "puppeteer";
import dotenv from "dotenv";

dotenv.config();
export const scrape = async () => {
	const browser = await puppeteer.launch({ headless: process.env.NODE_ENV === "production" });

	for (const category in mercator) {
		if (!mercator[category]) continue;

		let nextUrl = mercator[category];
		while (true) {
			const page = await browser.newPage();
			page.setDefaultNavigationTimeout(120000);

			try {
				if (process.env.NODE_ENV === "production") {
					await page.setUserAgent(
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
					);

					await page.setExtraHTTPHeaders({
						"Accept-Language": "en-US,en;q=0.9",
						"Accept-Encoding": "gzip, deflate, br",
						"Referer": "https://mercator.si/",
					});
				}

				// await page.goto(nextUrl, { waitUntil: "networkidle2" });
				await page.goto(nextUrl, { waitUntil: "load", timeout: 120000 });
				await page.waitForSelector("div.product-list", { timeout: 60000 });
				const content = await page.evaluate(() => {
					const images = document.querySelectorAll("img.js-product-item__image");
					images.forEach(img => {
						if (img.dataset.src) {
							img.src = img.dataset.src;
						}
					});

					const items = Array.from(document.querySelectorAll("div.product-list > .product-item"));
					return items.map(item => {
						const title = item.querySelector("span.product-item__name").textContent;
						const imageURL = item.querySelector("img.js-product-item__image").getAttribute("src");
						const price = parseFloat(item.querySelector("div.loyalty-price__original-price > span.loyalty-price__amount").textContent
							.replace("\n", "")
							.replace("€", "")
							.replace(",", ".")
							.trim(),
						);
						return { title, imageURL, price };
					});
				});

				for (const item of content) {
					console.log("Storing item in database:", item);
					const response = await fetch(process.env.API_URL, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${process.env.API_TOKEN}`,
						},
						body: JSON.stringify({
							title: item.title,
							imageURL: item.imageURL,
							price: item.price,
							discount: 0,
							category: category,
							store: "mercator",
						}),
					});
					const data = await response.json();
					console.log(data);
				}

				const nextButton = await page.$("li.pagination-input__item a.pagination-input__step--next");
				if (nextButton) {
					const isClickable = await page.evaluate(button => {
						const style = window.getComputedStyle(button);
						return style.pointerEvents !== "none"; // Check if pointer-events is not 'none'
					}, nextButton);

					if (isClickable) {
						nextUrl = await page.evaluate(button => button.href, nextButton);
						console.log("[INFO]: Finished processing, navigating to:", nextUrl);
					} else {
						console.log("[INFO]: Next button is not clickable. Likely on the last page.");
						break;
					}
				} else {
					console.log("[INFO]: Next button not found. Likely on the last page.");
					nextUrl = null;
					break;
				}
			} catch (error) {
				console.error("[ERROR]: An error occurred while processing the page:", error);
				nextUrl = null;
			} finally {
				await page.close();
			}
		}
		console.log("[INFO]: Finished processing all pages for URL:", mercator[category], ", category:", category);
	}

	await browser.close();
};
