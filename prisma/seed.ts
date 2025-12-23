import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/services/prisma.js";

const csvFilePath = path.resolve(process.cwd(), "prisma/regions.csv");

interface RegionRecord {
    UID: string;
    Назва: string;
    [key: string]: string;
}
async function seedRegions() {
    const file = fs.readFileSync(csvFilePath, {encoding: "utf-8"});
    const records = parse(file, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as RegionRecord[];

    let count = 0;
    for (const record of records) {
        const apiId = parseInt(record["UID"]);
        const name = record["Назва"];
        if (!apiId || !name) {
            console.warn(`Skipping invalid record: ${JSON.stringify(record)}`);
            continue;
        }

        await prisma.region.upsert({
            where: { apiId: apiId},
            update: { 
                name: name,
            },
            create: {
            apiId: apiId,
            name: name,
            isAlertActive: false,
        },
     });
        count++;
    }
    console.log(`Seeded ${count} regions.`);
}

seedRegions()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("Error seeding regions:", e);
        await prisma.$disconnect();
        process.exit(1);
    });