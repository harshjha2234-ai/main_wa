import getBrowserInstance from "../../utils/chromium/browserLaunch.js";

const timeout_option = {
    timeout: 90000
};

const ac_4 = (data2) => {
    const { tax_history } = data2.result;
    const yearMap = new Map();
    let maxYear = null;
    let minYear = null;
    let hasUnpaid = false;

    tax_history.forEach(({ year, status }) => {
        yearMap.set(year, status);
        if (maxYear === null || year > maxYear) maxYear = year;
        if (minYear === null || year < minYear) minYear = year;
        if (status === "Unpaid") hasUnpaid = true;
    });

    const dueTax = Array.from(yearMap.entries())
        .filter(([_, status]) => status === "Unpaid")
        .map(([year]) => tax_history.find(entry => entry.year === year));

    if (dueTax.length === 0 && tax_history.length) {
        const mostRecentYear = maxYear;
        data2.result.tax_history = tax_history.filter(entry => entry.year === mostRecentYear);

        const paymentType = data2.result.tax_history.length === 2 ? "Semi-annual" : "Annual";
        data2.result.tax_history.forEach(el => {
            el.payment_type = paymentType;
        });

        data2.result.notes = `ALL PRIORS ARE PAID, first due date is 04/30 and the last due date is 10/31`;
        data2.result.delinquent = "NONE";
    } else {
        data2.result.tax_history = dueTax;
        data2.result.notes = `PRIOR ${dueTax.length > 1 ? "Years" : "Year"} TAXES ARE DUE, First half taxes are due 04/30, and second half taxes are due 10/31 of each year.`;
        data2.result.delinquent = "YES";
    }
};


const ac_3 = (page, urls, data) => {
    return new Promise(async (resolve, reject) => {
        try {
            await page.goto(urls.Treasurer, { waitUntil: "domcontentloaded" });

            const data2 = await page.evaluate((data) => {
                data.tax_history = data.tax_history || [];
                let isDue = false;
                let dueData = [];

                const dueTable = document.getElementById("cphContent_CurrentTaxYearInterest1_GridView1");
                if (dueTable) {
                    isDue = true;
                    dueTable.querySelectorAll("tbody tr")?.forEach((tr, i) => {
                        if (i === 0) return;
                        const tds = tr.querySelectorAll("td");

                        let due = {
                            jurisdiction: "County",
                            year: tds[3] ? tds[3]?.textContent.trim().slice(0, 4) : "",
                            payment_type: "",
                            status: "Unpaid",
                            base_amount: tds[4] ? tds[4]?.textContent.trim() : "$0.00",
                            amount_paid: "$0.00",
                            amount_due: tds[7] ? tds[7]?.textContent.trim() : "$0.00",
                            mailing_date: "N/A",
                            due_date: "10/31",
                            delq_date: "11/01",
                            paid_date: "",
                        };
                        dueData.push(due);
                    });
                }

                document.querySelectorAll(".dataGridSecondary")?.forEach((table) => {
                    const trs = table.querySelectorAll("tbody tr");
                    for (let index = 1; index < trs.length; index++) {
                        const tds = trs[index]?.querySelectorAll("td");

                        let th_data = {
                            jurisdiction: "County",
                            year: tds[0] ? tds[0]?.textContent.split("-")[0] : "",
                            payment_type: "",
                            status: "Paid",
                            base_amount: tds[2] ? tds[2]?.textContent.trim() : "$0.00",
                            amount_paid: tds[4] ? tds[4]?.textContent.trim() : "$0.00",
                            amount_due: "$0.00",
                            mailing_date: "N/A",
                            due_date: "10/31",
                            delq_date: "11/01",
                            paid_date: tds[1] ? tds[1]?.textContent.trim() : "",
                        };
                        if (!isDue) data.tax_history.push(th_data);
                    }
                });

                dueData.forEach((due) => data?.tax_history?.push(due));
                return data;
            }, data);

            resolve({ result: data2 }); 
        } catch (error) {
            reject(error);
        }
    });
};


const ac_2 = (page, urls) => {
    return new Promise(async (resolve, reject) => {
        try {
            const status = await page.goto(urls.Treasurer, { waitUntil: "domcontentloaded" });

            const data = await page.evaluate(() => {
                const data = {
                    processed_date: "",
                    order_number: "",
                    borrower_name: "",
                    owner_name: [],
                    property_address: "",
                    parcel_number: "",
                    land_value: "",
                    improvements: "",
                    total_assessed_value: "",
                    exemption: "",
                    total_taxable_value: "",
                    taxing_authority: "Adams County Treasurer 210 W Broadway Suite 203 Ritzville, WA 99169 ",
                    notes: "",
                    delinquent: "",
                    tax_history: [],
                }

                data["owner_name"] = document
                    .querySelector("#cphContent_ParcelOwnerInfo1_lbOwnerName")
                    ?.innerHTML.replace(/amp;/g, "")
                    .split(/[,&]/);
                // Property Address
                data["property_address"] = document.querySelector(
                    "#cphContent_ParcelOwnerInfo1_lbSitus"
                )?.textContent;
                /// Total Assessed Value & Total Taxable Value
                data["total_assessed_value"] = document.querySelectorAll(
                    "#cphContent_ctl04_grdValuations td"
                )[5]?.textContent;
                /// Total Taxable Value
                data["total_taxable_value"] = document.querySelectorAll(
                    "#cphContent_ctl04_grdValuations td"
                )[7]?.textContent;

                // Parcel Number
                data["parcel_number"] = document.querySelector(
                    "#cphContent_ParcelOwnerInfo1_lbParcelNumber"
                )?.textContent;

                //Land Value
                data["land_value"] = document.querySelectorAll(
                    "#cphContent_ctl00_dvMarketValues  tr td"
                )[1]?.textContent;

                data["improvements"] = document.querySelectorAll(
                    "#cphContent_ctl00_dvMarketValues  tr td"
                )[3]?.textContent;


                return data;
            })

            resolve(data)
        } catch (error) {
            console.log(error);
            reject(new Error(error.message));
        }
    })
}

const ac_1 = (page, url, account) => {
    return new Promise(async (resolve, reject) => {
        try {
            const status = await page.goto(url, { waitUntil: "domcontentloaded" });
            //I AGREE PAGE
            await page.waitForSelector("#cphContent_btnAgree", timeout_option),
                await Promise.all([
                    page.locator("input[name='ctl00$cphContent$btnAgree']").click(),
                    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                ]);

            //SEARCH FORM PAGE
            await page.waitForSelector("#q", timeout_option),
                await page.locator("input[name='q']").fill(account),
                // if enter doent work
                // await page.waitForSelector("#submit"timeout_option)
                await Promise.all([
                    //  page.locator("#submit").click()  
                    page.keyboard.press("Enter"),
                    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                ]);

            const nextUrls = await page.evaluate(() => {
                let urls = {
                    Assessor: "",
                    Treasurer: ""
                }
                urls['Assessor'] = document.querySelectorAll("li a")[0].href
                urls['Treasurer'] = document.querySelectorAll("li a")[1].href
                return urls
            })

            resolve(nextUrls)
        } catch (error) {
            console.log(error);
            reject(new Error(error.message));
        }
    });
};

const account_search = (page, url, account) => {
    return new Promise((resolve, reject) => {
        ac_1(page, url, account)
            .then((urls) => {
                ac_2(page, urls)
                    .then((data) => {
                        ac_3(page, urls, data)
                            .then((data2) => {
                                ac_4(data2);
                                resolve(data2.result);
                            })
                            .catch((error) => {
                                console.error("Error in ac_3:", error);
                                reject(error);
                            });
                    })
                    .catch((error) => {
                        console.error("Error in ac_2:", error);
                        reject(error);
                    });
            })
            .catch((error) => {
                console.error("Error in ac_1:", error);
                reject(error);
            });
    });
};


const search = async (req, res) => {
    const { fetch_type, account } = req.body;
    try {
        const url =
            "https://adamswa-taxsifter.publicaccessnow.com/Search/Results.aspx";

        if (!fetch_type && (fetch_type != "html" || fetch_type != "api")) {
            return res.status(200).render("error_data", {
                error: true,
                message: "Invalid Access",
            });
        }

        const browser = await getBrowserInstance();
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36"
        );

        page.setDefaultNavigationTimeout(90000);

        // INTERCEPT REQUESTS AND BLOCK CERTAIN RESOURCE TYPES
        await page.setRequestInterception(true);
        page.on("request", (req) => {
            if (
                req.resourceType() === "stylesheet" ||
                req.resourceType() === "font" ||
                req.resourceType() === "image"
            ) {
                req.abort();
            } else {
                req.continue();
            }
        });

        if (fetch_type == "html") {
            // FRONTEND ENDPOINT
            account_search(page, url, account)
                .then((data) => {
                    res.status(200).render("parcel_data_official", data);
                })
                .catch((error) => {
                    console.log(error);
                    res.status(200).render("error_data", {
                        error: true,
                        message: error.message,
                    });
                })
                .finally(async () => {
                    await context.close();
                });
        } else if (fetch_type == "api") {
            // API ENDPOINT
            account_search(page, url, account)
                .then((data) => {
                    res.status(200).json({
                        result: data,
                    });
                })
                .catch((error) => {
                    console.log(error);
                    res.status(500).json({
                        error: true,
                        message: error.message,
                    });
                })
                .finally(async () => {
                    await context.close();
                });
        }
    } catch (error) {
        console.log(error);
        if (fetch_type == "html") {
            res.status(200).render("error_data", {
                error: true,
                message: error.message,
            });
        } else if (fetch_type == "api") {
            res.status(500).json({
                error: true,
                message: error.message,
            });
        }
    }
};

export { search };
