"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const categories = [
        'Office & stationery',
        'ICT & electronics',
        'Construction materials',
        'Food & beverages',
        'Cleaning supplies',
        'Furniture',
        'Industrial supplies',
        'Automotive',
        'Medical supplies',
        'Uniforms & PPE',
        'Professional services',
        'Logistics',
        'Agriculture',
        'Hospitality',
        'Other',
    ];
    for (const name of categories) {
        await prisma.category.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }
    const organization = await prisma.organization.upsert({
        where: { id: 'org-demo' },
        update: {},
        create: {
            id: 'org-demo',
            legalName: 'Dira Procurement Co.',
            tradingName: 'Dira',
            country: 'Botswana',
            city: 'Gaborone',
            businessType: 'B2B',
            email: 'hello@dira.local',
            type: 'BOTH',
            verificationStatus: 'VERIFIED',
        },
    });
    const passwordHash = await bcryptjs_1.default.hash('Password123!', 12);
    const user = await prisma.user.upsert({
        where: { email: 'buyer@dira.local' },
        update: {},
        create: {
            id: 'user-demo',
            firstName: 'Demo',
            lastName: 'Buyer',
            email: 'buyer@dira.local',
            phone: '+26770000000',
            passwordHash,
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        },
    });
    await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
        update: {},
        create: {
            id: 'member-demo',
            organizationId: organization.id,
            userId: user.id,
            role: 'OWNER',
            status: 'ACTIVE',
        },
    });
    console.log('Seeded Dira development data.');
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
