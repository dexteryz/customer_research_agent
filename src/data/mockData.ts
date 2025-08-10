// Mock data for when Supabase is not accessible

export const mockCustomerData = [
  {
    fields: {
      name: "Sarah Johnson",
      email: "sarah@acmecorp.com",
      company: "Acme Corp",
      feedback: "Great product but onboarding could be smoother. The team is loving the collaboration features.",
      segment: "Enterprise",
      source: "Customer Interview"
    },
    tags: ["Enterprise", "Onboarding", "Collaboration"],
    category: "Product Feedback"
  },
  {
    fields: {
      name: "Mike Chen",
      email: "mike@techstart.io",
      company: "TechStart",
      feedback: "Pricing is a bit high for our startup, but the features are exactly what we need. Mobile app needs improvement.",
      segment: "Startup",
      source: "Support Ticket"
    },
    tags: ["Pricing", "Mobile", "Startup"],
    category: "Feature Request"
  },
  {
    fields: {
      name: "Lisa Rodriguez",
      email: "lisa@designco.com",
      company: "Design Co",
      feedback: "The new dashboard design is fantastic! Much more intuitive than the previous version. Great work!",
      segment: "SMB",
      source: "NPS Survey"
    },
    tags: ["Dashboard", "Design", "Positive"],
    category: "Compliment"
  },
  {
    fields: {
      name: "David Kim",
      email: "david@enterprise.com",
      company: "Enterprise Inc",
      feedback: "We need better admin controls and user management. Currently managing 500+ users is challenging.",
      segment: "Enterprise",
      source: "Feature Request"
    },
    tags: ["Admin", "User Management", "Enterprise"],
    category: "Feature Request"
  },
  {
    fields: {
      name: "Rachel Green",
      email: "rachel@startup.co",
      company: "Startup Co",
      feedback: "Integration with Slack would be game-changing for our workflow. Also, the mobile app crashes frequently.",
      segment: "Startup",
      source: "Customer Interview"
    },
    tags: ["Integration", "Slack", "Mobile", "Bugs"],
    category: "Feature Request"
  }
];


export const mockStats = {
  totalFeedback: 156,
  avgSentiment: 3.8,
  responseRate: 67,
  topSources: [
    { source: "Customer Interview", count: 45 },
    { source: "Support Ticket", count: 38 },
    { source: "NPS Survey", count: 32 },
    { source: "Feature Request", count: 25 },
    { source: "Social Media", count: 16 }
  ]
};