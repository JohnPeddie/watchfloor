import { prisma } from "../src/lib/db";

const BRIEF_DATE = "2026-08-31";

const STORIES = [
  {
    headline: "Grand Canyon Flooding Leaves People Missing and Disrupts Park Operations",
    body: `One person died and about 15 remain unaccounted for after flash flooding Saturday in Grand Canyon National Park.

More than 60 people were airlifted from the canyon after flooding along Bright Angel Creek washed out footbridges, moved boulders, and damaged the park’s sole water pipeline.

Overnight lodging will be suspended starting Monday because of limited potable water, while Bright Angel Campground, the North Kaibab Trail, and Phantom Ranch remain closed.

Additional rain and thunderstorms are possible Monday, with the WPC maintaining a Level 2 of 4 risk for excessive rainfall.`,
    placeLabel: "Grand Canyon",
    lat: 36.1069,
    lng: -112.1129,
    tags: ["POLITICAL", "SUPPLY"],
    precedence: "PRIORITY",
  },
  {
    headline: "Russia Warns NATO Over Expanding Arctic Military Presence",
    body: `Russia described NATO’s expanding Arctic presence as a direct security threat, warning that allied exercises could raise the risk of confrontation.

NATO’s Arctic Sentry mission comes alongside expanded Nordic defense activity, including Norway’s brigade expansion.

Moscow views the region as critical to its nuclear posture, Northern Fleet access, and Asia-facing shipping ambitions.

NATO officials have also cited rising Russian hybrid activity in Europe, increasing incident risks around military movements, infrastructure, and strategic sea routes.`,
    placeLabel: "Arctic",
    lat: 78.0,
    lng: 15.0,
    tags: ["DEFENCE", "ESPIONAGE", "NUCLEAR", "MARITIME"],
    precedence: "IMMEDIATE",
  },
  {
    headline: "U.S.-Iran Escalation Intensifies Around the Strait of Hormuz",
    body: `U.S. strikes targeted Iranian launchers on Larak Island as Iran reportedly launched missiles toward U.S. forces in Jordan.

The strikes near the Strait of Hormuz suggest Washington is prioritizing the disruption of Iranian mining activity that could further restrict global oil flows.

Iran’s response demonstrates its continued willingness to target U.S. regional positions despite interceptions.

Tensions also spread to the UAE, where authorities intercepted an Iranian drone over territorial waters and condemned the incident.`,
    placeLabel: "Strait of Hormuz",
    lat: 26.5667,
    lng: 56.25,
    tags: ["DEFENCE", "KINETIC", "ENERGY", "MARITIME"],
    precedence: "FLASH",
  },
  {
    headline: "Failed Niger Mutiny Highlights Strains Within Military Government",
    body: `A failed mutiny in Niger’s capital exposed internal pressure on the military government amid worsening security conditions.

Soldiers challenged loyalist forces at Niamey’s airport and near the presidential district before the uprising was suppressed with Russian Africa Corps support.

The unrest appears linked to jihadist violence, battlefield losses, and troop welfare grievances.

Russia’s role highlights the government’s reliance on foreign support, while Algeria, Turkey, and Sahel allies have also backed regime stability.`,
    placeLabel: "Niamey",
    lat: 13.5116,
    lng: 2.1254,
    tags: ["KINETIC", "TERROR", "ESPIONAGE", "POLITICAL"],
    precedence: "IMMEDIATE",
  },
  {
    headline: "Pacific Islands Forum Faces Geopolitical Pressure",
    body: `The Pacific Islands Forum opened in Palau as external powers compete for influence across strategically important Pacific island states.

China-Taiwan tensions, expanding U.S. security ties, and increased engagement from Australia and New Zealand are shaping discussions.

Leaders are also focused on climate, energy, and economic resilience across the region.

The forum’s consensus model faces strain following disagreement over criticism of Chinese missile activity, while geopolitical competition could weaken regional unity amid existing fuel, weather, and supply-chain risks.`,
    placeLabel: "Palau",
    lat: 7.5149,
    lng: 134.5825,
    tags: ["DEFENCE", "MARITIME", "SUPPLY", "POLITICAL"],
    precedence: "PRIORITY",
  },
];

async function main() {
  const brief = await prisma.dailyBrief.upsert({
    where: { date: BRIEF_DATE },
    create: {
      date: BRIEF_DATE,
      title: "Global Radar Report – Monday, 31 August 2026",
    },
    update: {
      title: "Global Radar Report – Monday, 31 August 2026",
    },
  });

  await prisma.briefStory.deleteMany({ where: { briefId: brief.id } });

  for (let i = 0; i < STORIES.length; i++) {
    const story = STORIES[i];
    await prisma.briefStory.create({
      data: {
        briefId: brief.id,
        headline: story.headline,
        body: story.body,
        tags: JSON.stringify(story.tags),
        precedence: story.precedence,
        placeLabel: story.placeLabel,
        lat: story.lat,
        lng: story.lng,
        sortOrder: i,
        relatedArticleIds: "[]",
      },
    });
  }

  console.log(`Seeded brief ${BRIEF_DATE} with ${STORIES.length} stories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
