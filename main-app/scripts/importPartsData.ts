import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Modify the regex pattern and parsing logic
async function importExcelFiles(directory: string) {
  // Get all Excel files from the specified directory
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.xlsx'));

  for (const file of files) {
    const filePath = path.join(directory, file);
    console.log(`Processing file: ${filePath}`);
    
    // Load the Excel file
    const workbook = XLSX.readFile(filePath);
    
    // Extract machine model and PIN break from the Excel filename using a refined regex
    const filename = path.basename(file, path.extname(file));
    const regex = /(.+?) \(PIN ([\w_ -]+)\)/;
    const match = filename.match(regex);
    
    if (!match) {
      console.error(`Failed to extract machine model and PIN break from filename: ${filename}`);
      continue;
    }

    const [_, machineModel, pinRange] = match;

    // Extract pinLow and pinHigh if available in the pinRange (e.g., D0708125-716724)
    let pinLow: string | null = null;
    let pinHigh: string | null = null;
    const pinRegex = /(\w+)-(\w+)/;
    const pinMatch = pinRange.match(pinRegex);
    if (pinMatch) {
      pinLow = pinMatch[1];
      pinHigh = pinMatch[2];
    } else {
      pinLow = pinRange.trim(); // Single value
    }

    // Create or update the machine data in the database
    const machine = await prisma.machineData.upsert({
      where: { machineId: machineModel },
      update: {
        model: machineModel,
        pinLow: pinLow,
        pinHigh: pinHigh,
      },
      create: {
        machineId: machineModel,
        model: machineModel,
        pinLow: pinLow,
        pinHigh: pinHigh,
      },
    });

    // Iterate over all sheets in the workbook
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      // Iterate over rows and insert parts data
      rows.forEach(async (row: any) => {
        const { 
          'Part Description': partDescription,
          'Part Number': partId,
          'Quantity Required': quantityRequired,
          'Canvas Image': canvasImage,
          'Breadcrumb': breadcrumb,
        } = row;

        try {
          await prisma.partData.create({
            data: {
              partId,
              partDescription,
              quantityRequired: parseInt(quantityRequired, 10),
              canvasImage: canvasImage || null,
              breadcrumb,
              machine: {
                connect: { id: machine.id },
              },
            },
          });
        } catch (error) {
          console.error(`Failed to insert part data for sheet: ${sheetName}`, error);
        }
      });
    });
  }
}

async function main() {
  const directory = 'C:\\coding projects\\johndeere scraper and data collection\\excel files';
  await importExcelFiles(directory);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
