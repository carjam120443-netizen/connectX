import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const existing = await prisma.space.findFirst();
  if (!existing) {
    await prisma.space.create({
      data: {
        name: "The Workshop",
        description: "A small corner of the internet for curious people.",
        channels: {
          create: [
            { name: "general", topic: "A place to talk about anything." },
            { name: "introductions", topic: "Say hello and meet the community." },
            { name: "tech-talk", topic: "Talk about technology and projects." },
            { name: "showcase", topic: "Share what you are building." }
          ]
        }
      }
    });
    console.log("Created the starter ConnectX space.");
  } else {
    console.log("Starter space already exists; seed skipped.");
  }
} finally {
  await prisma.$disconnect();
}