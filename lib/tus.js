import { tus } from "./stores.js";
import puppeteer from "puppeteer";
import dotenv from "dotenv";

dotenv.config();
export const scrape = async () => {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	for (const category in tus) {
		if (!tus[category]) continue;

		let nextUrl = tus[category];
		let pageNumber = 1;
		console.log("Scraping category:", category);
		while (true) {
			await page.goto(nextUrl, { waitUntil: "networkidle2" });
			const content = await page.evaluate(() => {
				const images = document.querySelectorAll("figure img.thumbnail");
				images.forEach(img => {
					if (img.dataset.src) {
						img.src = img.dataset.src;
					}
				});

				const items = Array.from(document.querySelectorAll("ul.products > li.product"));
				return items.map(item => {
					const title = item.querySelector("div.card-product h3 > a").textContent;
					const imageURL = item.querySelector("div.card-product img.thumbnail").getAttribute("src");

					const priceLabel = item.querySelector("div.card-product p.price-regular > label");
					const priceSpan = item.querySelector("div.card-product span.price");
					const priceText = priceLabel ? priceLabel.textContent : priceSpan.textContent;
					const price = parseFloat(priceText
						.replace("\n", "")
						.replace("Redna cena: ", "")
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
						store: "tus",
					}),
				});
				const data = await response.json();
				console.log(data);
			}

			const nextButton = await page.$(`div.pagination > a[data-index="${++pageNumber}"]`);
			if (nextButton) {
				nextUrl = await page.evaluate(button => button.href, nextButton);
				console.log("[INFO]: Finished processing, navigating to:", nextUrl);
			} else {
				console.log("[INFO]: Next button not found. Likely on the last page.");
				break;
			}
		}
		console.log("[INFO]: Finished processing all pages for URL:", tus[category], ", category:", category);
	}

	await browser.close();
};
