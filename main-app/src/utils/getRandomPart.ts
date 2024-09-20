// utils/getRandomPart.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getRandomMachineAndPart() {
  // Fetch all machines with parts
  const machines = await prisma.machineData.findMany({
    include: {
      parts: true,
    },
  });

  // Select a random machine
  const randomMachine = machines[Math.floor(Math.random() * machines.length)];

  // Select a random part from the machine's parts
  const randomPart = randomMachine.parts[Math.floor(Math.random() * randomMachine.parts.length)];

  // Return the machine model and part description (without the part number)
  return {
    machineModel: randomMachine.model,
    partDescription: randomPart.partDescription,
    partNumber: randomPart.partId,  // Include the part number for comparison
    breadcrumb: randomPart.breadcrumb // Breadcrumb to assist in hints
  };
}
