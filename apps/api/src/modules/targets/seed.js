import { MonthlyTarget } from './model.js';
import { Campaign } from '../campaigns/model.js';
import { Profile } from '../referenceData/profile.model.js';
import { Person } from '../people/model.js';

export async function seedTargetsAndCampaigns() {
  const profiles = await Profile.find({});
  if (profiles.length === 0) return { targets: [], campaigns: [] };

  const admin = await Person.findOne({ role: 'admin' });
  const head = await Person.findOne({ role: 'marketing_head' }) || admin;
  const lead = await Person.findOne({ role: 'team_lead' }) || head;

  const currentMonth = new Date().toISOString().slice(0, 7); // e.g. '2026-10'

  // 1. Seed Org-wide and profile-specific MonthlyTargets
  const targetSeeds = [
    {
      month: currentMonth,
      profileId: null, // Org-wide
      revenueTarget: 2500000,
      leadsTarget: 3500,
      qualifiedLeadsTarget: 1200,
      budget: 500000,
      createdBy: head?._id,
    },
    ...profiles.map((p, idx) => ({
      month: currentMonth,
      profileId: p._id,
      revenueTarget: 300000 + idx * 50000,
      leadsTarget: 400 + idx * 50,
      qualifiedLeadsTarget: 150 + idx * 20,
      budget: 60000 + idx * 10000,
      createdBy: head?._id,
    })),
  ];

  const seededTargets = [];
  for (const t of targetSeeds) {
    const existing = await MonthlyTarget.findOneAndUpdate(
      { month: t.month, profileId: t.profileId },
      { $set: t },
      { upsert: true, new: true }
    );
    seededTargets.push(existing);
  }

  // Map profileId -> target
  const targetMap = new Map();
  seededTargets.forEach((t) => {
    if (t.profileId) {
      targetMap.set(t.profileId.toString(), t);
    }
  });
  const orgWideTarget = seededTargets.find((t) => !t.profileId) || seededTargets[0];

  // 2. Seed Campaigns ensuring strict targetId and relatedOKR
  const hacaProf = profiles.find((p) => p.code === 'haca') || profiles[0];
  const designProf = profiles.find((p) => p.code === 'haca_design_school') || profiles[0];
  const mideastProf = profiles.find((p) => p.code === 'haca_mideast') || profiles[0];
  const techProf = profiles.find((p) => p.code === 'haca_tech_school') || profiles[0];

  const campaignSeeds = [
    {
      name: 'Always-On Inbound & Nurture',
      profileId: hacaProf._id,
      targetId: targetMap.get(hacaProf._id.toString())?._id || orgWideTarget._id,
      relatedOKR: 'Q4 Inbound Lead Surge: 5,000 qualified student leads across India & Middle East',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      status: 'In Progress',
      goalType: 'Leads',
      goalValue: 800,
      expectedOutcome: 'Lead Generation',
      budget: 150000,
      spend: 65000,
      leadsActual: 420,
      qualifiedLeadsActual: 180,
      ownerId: lead?._id || admin?._id,
      progressPct: 52,
      description: 'Continuous digital marketing, paid ads and organic acquisition across Meta & Google.',
    },
    {
      name: 'Design School Masterclass Series',
      profileId: designProf._id,
      targetId: targetMap.get(designProf._id.toString())?._id || orgWideTarget._id,
      relatedOKR: 'Elevate brand positioning to top creative school in South India',
      startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      status: 'In Progress',
      goalType: 'Enrollments',
      goalValue: 250,
      expectedOutcome: 'Brand Awareness',
      budget: 80000,
      spend: 32000,
      leadsActual: 210,
      qualifiedLeadsActual: 95,
      ownerId: lead?._id || admin?._id,
      progressPct: 40,
      description: 'Interactive workshops and portfolio reviews with top industry creative directors.',
    },
    {
      name: 'Mideast Executive Outreach 2026',
      profileId: mideastProf._id,
      targetId: targetMap.get(mideastProf._id.toString())?._id || orgWideTarget._id,
      relatedOKR: 'Capture 20% market share in UAE & Saudi creative technology education',
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'At Risk',
      goalType: 'Leads',
      goalValue: 150,
      expectedOutcome: 'Conversion',
      budget: 100000,
      spend: 58000,
      leadsActual: 45,
      qualifiedLeadsActual: 18,
      ownerId: head?._id || admin?._id,
      progressPct: 30,
      description: 'Localized Arabic and English ad sets across LinkedIn, Meta and Snapchat.',
    },
    {
      name: 'Tech School Alumni Reactivation',
      profileId: techProf._id,
      targetId: targetMap.get(techProf._id.toString())?._id || orgWideTarget._id,
      relatedOKR: 'Reactivate past inquiries and graduate placements into advanced AI & coding bootcamps',
      startDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'Completed',
      goalType: 'Reactivations',
      goalValue: 300,
      expectedOutcome: 'Reactivation',
      budget: 50000,
      spend: 49200,
      leadsActual: 310,
      qualifiedLeadsActual: 140,
      ownerId: lead?._id || admin?._id,
      progressPct: 100,
      description: 'WhatsApp broadcast, email drip campaign, and demo session invites.',
    },
  ];

  const seededCampaigns = [];
  for (const c of campaignSeeds) {
    const existing = await Campaign.findOneAndUpdate(
      { name: c.name, profileId: c.profileId },
      { $set: c },
      { upsert: true, new: true }
    );
    seededCampaigns.push(existing);
  }

  return { targets: seededTargets, campaigns: seededCampaigns };
}
