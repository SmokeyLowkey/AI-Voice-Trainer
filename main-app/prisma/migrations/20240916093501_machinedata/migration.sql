/*
  Warnings:

  - You are about to drop the column `name` on the `PartData` table. All the data in the column will be lost.
  - Added the required column `breadcrumb` to the `PartData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `partDescription` to the `PartData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantityRequired` to the `PartData` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MachineData" ADD COLUMN     "pinHigh" TEXT,
ADD COLUMN     "pinLow" TEXT;

-- AlterTable
ALTER TABLE "PartData" DROP COLUMN "name",
ADD COLUMN     "breadcrumb" TEXT NOT NULL,
ADD COLUMN     "canvasImage" TEXT,
ADD COLUMN     "partDescription" TEXT NOT NULL,
ADD COLUMN     "quantityRequired" INTEGER NOT NULL;
