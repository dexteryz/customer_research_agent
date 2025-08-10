// Test script for Notion data import and transformation
// Run with: node test-notion-data-import.js

// Note: To run locally, you'll need to first build the project or use ts-node
// This test demonstrates the expected API payload and response format

// Sample data based on your Notion automation structure
const sampleNotionData = [
  {
    id: "test-meeting-1",
    created_time: "2024-01-15T10:00:00Z",
    properties_value: {
      "Name": [
        {
          plain_text: "Customer Discovery Call - Acme Corp"
        }
      ],
      "AI summary": [
        {
          plain_text: "Customer expressed frustration with current time tracking tools. Main pain points: 1) Complex setup process takes weeks 2) Limited integration with existing CRM 3) Lack of automated reporting features. They're particularly interested in our consulting program to help them optimize their workflow. Key decision maker is Sarah (VP Operations). Next steps: send demo video and pricing proposal."
        }
      ],
      "Meeting Notes": [
        {
          plain_text: "**Meeting with Acme Corp - Time Tracking Solution Discussion**\n\n**Attendees:** Sarah Johnson (VP Operations), Mike Chen (IT Director), [Our Team]\n\n**Background:**\nAcme Corp is a mid-size consulting firm with 150+ employees across 4 offices. Currently using a patchwork of Excel sheets and basic time tracking apps. Growing rapidly and need enterprise-level solution.\n\n**Current Pain Points Discussed:**\n1. **Complex Setup Process**\n   - Sarah: \"Our IT team spent 3 weeks trying to configure our current system and we're still not happy with it\"\n   - Mike: \"Every new employee takes 2-3 days just to understand how to log their time properly\"\n   - Multiple integrations required, each with its own learning curve\n\n2. **Integration Challenges**\n   - Current CRM (Salesforce) doesn't sync properly with time tracking\n   - Billing discrepancies due to manual data entry\n   - Sarah: \"We're losing billable hours because of system gaps\"\n\n3. **Reporting Limitations**\n   - No automated weekly/monthly reports\n   - Managers manually compile data from different systems\n   - Sarah: \"I spend 5 hours every week just trying to understand where our time is going\"\n\n**Specific Requirements:**\n- Integration with Salesforce CRM\n- Automated client billing reports\n- Manager dashboard for real-time project tracking\n- Mobile app for field consultants\n- SOC2 compliance (mandatory for their enterprise clients)\n\n**Budget & Timeline:**\n- Budget: $15-25k annually\n- Implementation needed by Q2 2024\n- Willing to pay premium for full-service setup\n\n**Decision Process:**\n- Sarah has final approval\n- IT team (Mike) needs technical validation\n- Will present to leadership team next month\n\n**Competitive Landscape:**\n- Currently evaluating 3 other vendors\n- Previous bad experience with ClickTime\n- Heard good things about our customer support\n\n**Next Steps:**\n1. Send demo video showcasing Salesforce integration\n2. Provide detailed pricing proposal with implementation timeline\n3. Schedule technical deep-dive with Mike's team\n4. Connect them with similar client reference (if they agree)\n\n**Opportunities Identified:**\n- Potential for consulting engagement to optimize their workflow\n- Upsell opportunity for training and change management\n- Could be a great case study for mid-market segment\n\n**Follow-up Required:**\n- Demo video (by Friday)\n- Pricing proposal (by next Tuesday)\n- Technical spec sheet for IT review"
        }
      ],
      "Meeting Type": {
        name: "Customer Call"
      },
      "Attendees": [
        {
          name: "Sarah Johnson",
          person: {
            email: "sarah@acmecorp.com"
          }
        },
        {
          name: "Mike Chen",
          person: {
            email: "mike@acmecorp.com"
          }
        }
      ],
      "Event time": {
        start: "2024-01-15T15:00:00Z",
        end: "2024-01-15T16:00:00Z"
      }
    }
  },
  {
    id: "test-meeting-2",
    created_time: "2024-01-18T11:30:00Z",
    properties_value: {
      "Name": [
        {
          plain_text: "Follow-up Call - TechStart Inc"
        }
      ],
      "AI summary": [
        {
          plain_text: "Follow-up on their consulting needs. TechStart is a 10-person startup struggling with project management. Pain points: 1) Team members working in silos 2) No clear process documentation 3) Difficulty scaling their operations. Very interested in our Part-Time Consulting Launchpad program. Budget approved for Q1. Ready to move forward with onboarding next week."
        }
      ],
      "Meeting Type": {
        name: "Customer Call"
      },
      "Attendees": [
        {
          name: "Alex Rodriguez",
          person: {
            email: "alex@techstart.io"
          }
        }
      ],
      "Event time": {
        start: "2024-01-18T14:30:00Z"
      }
    }
  },
  {
    id: "test-meeting-3",
    created_time: "2024-01-22T09:15:00Z",
    properties_value: {
      "Name": [
        {
          plain_text: "Community Feedback Session - Beta Users"
        }
      ],
      "AI summary": [
        {
          plain_text: "Great feedback session with 5 beta community members. Overall satisfaction high (8.5/10 average). Key insights: 1) Members love the peer learning aspect 2) Want more structured networking opportunities 3) Asking for industry-specific discussion channels 4) Some confusion about accessing certain resources. Several members expressed interest in becoming community ambassadors. Need to improve onboarding flow and create better resource discovery."
        }
      ],
      "Meeting Type": {
        name: "Customer Call"
      },
      "Attendees": [
        {
          name: "Lisa Park",
          person: {
            email: "lisa@example.com"
          }
        },
        {
          name: "David Kim",
          person: {
            email: "david@example.com"
          }
        },
        {
          name: "Rachel Green",
          person: {
            email: "rachel@example.com"
          }
        }
      ],
      "Event time": {
        start: "2024-01-22T17:15:00Z"
      }
    }
  },
  {
    id: "test-meeting-4-notes-only",
    created_time: "2024-01-24T14:00:00Z",
    properties_value: {
      "Name": [
        {
          plain_text: "Customer Pain Point Session - FinTech Startup"
        }
      ],
      "Notes": [
        {
          plain_text: "**Customer Pain Point Deep Dive - FinTech Startup**\n\n**Company:** NextGen Financial\n**Stage:** Series A, 25 employees\n**Contact:** Jennifer Walsh, CTO\n\n**Current Situation:**\nThey're building a B2B payments platform but struggling with compliance and user adoption. Revenue growth has stalled at $500k ARR.\n\n**Key Pain Points Identified:**\n\n1. **Compliance Nightmare**\n   - \"We spend 40% of our engineering time on compliance requirements\"\n   - Different regulations in each state they operate\n   - Manual audit processes taking weeks\n   - Risk of penalties if they get it wrong\n\n2. **User Onboarding Friction**\n   - Current onboarding takes 2-3 weeks\n   - 60% drop-off rate during KYC process\n   - Jennifer: \"We're losing customers before they even start using our product\"\n   - No automated document verification\n\n3. **Integration Complexity**\n   - Each bank integration requires months of custom development\n   - Legacy banking systems with poor APIs\n   - \"Every integration feels like we're starting from scratch\"\n\n4. **Scaling Challenges**\n   - Manual transaction monitoring\n   - Customer support overwhelmed with basic questions\n   - No self-service options for common issues\n\n**Impact on Business:**\n- Engineering team burnout (2 developers quit last month)\n- Customer acquisition cost increased 200% in 6 months\n- Delayed product roadmap by 8 months\n- Considering pivot or shutdown if can't solve these issues\n\n**What They've Tried:**\n- Hired compliance consultant ($50k, minimal impact)\n- Tried 3 different KYC vendors (all had integration issues)\n- Built internal tools (too time-consuming to maintain)\n\n**Ideal Solution:**\n- Compliance automation platform\n- Streamlined onboarding (target: 24 hours)\n- Pre-built banking integrations\n- Self-service customer portal\n\n**Budget & Timeline:**\n- Budget: $10-20k/month for the right solution\n- Need solution in next 90 days\n- Board meeting in Q2 where they'll decide on pivot vs continue\n\n**Decision Makers:**\n- Jennifer Walsh (CTO) - technical decision\n- Marcus Thompson (CEO) - budget approval\n- Sarah Kim (COO) - implementation timeline\n\n**Next Actions:**\n- Schedule demo with their tech team\n- Prepare compliance case study\n- Connect with similar fintech client for reference\n- Proposal due by end of next week"
        }
      ],
      "Meeting Type": {
        name: "Customer Call"
      },
      "Attendees": [
        {
          name: "Jennifer Walsh",
          person: {
            email: "jennifer@nextgenfinancial.com"
          }
        }
      ],
      "Event time": {
        start: "2024-01-24T14:00:00Z"
      }
    }
  },
  {
    id: "test-meeting-5",
    created_time: "2024-01-25T16:00:00Z",
    properties_value: {
      "Name": [
        {
          plain_text: "Internal Team Sync"
        }
      ],
      "AI summary": [
        {
          plain_text: "Weekly team sync discussing project updates and roadmap priorities."
        }
      ],
      "Meeting Type": {
        name: "Internal Meeting"  // This should be filtered out
      },
      "Attendees": [
        {
          name: "Team Member 1"
        }
      ],
      "Event time": {
        start: "2024-01-25T16:00:00Z"
      }
    }
  }
];

console.log('🚀 Testing Notion Data Import API Payload...\n');

console.log('📊 Sample Data Summary:');
console.log(`- Total Notion entries: ${sampleNotionData.length}`);
console.log(`- Customer Calls: ${sampleNotionData.filter(item => item.properties_value["Meeting Type"]?.name === "Customer Call").length}`);
console.log(`- Non-Customer meetings: ${sampleNotionData.filter(item => item.properties_value["Meeting Type"]?.name !== "Customer Call").length}`);

console.log('\n📝 Simplified API Payload:');
// The API now accepts the raw Notion data array directly!
const apiPayload = sampleNotionData;

console.log(`- Total meetings in payload: ${apiPayload.length}`);
console.log(`- Customer calls expected: ${apiPayload.filter(item => item.properties_value["Meeting Type"]?.name === "Customer Call").length}`);

console.log('\n✅ API payload ready for testing!');

console.log('\n📋 Usage Instructions:');
console.log('1. POST your raw Notion data array directly to /api/notion-data-import');
console.log('2. No wrapper objects needed - just send the array from your automation');
console.log('3. Get back transformed customer feedback data and statistics');

// Example API call
console.log('\n🔗 Test with cURL:');
console.log(`
curl -X POST http://localhost:3000/api/notion-data-import \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(apiPayload)}'
`);

console.log('\n🌐 Production API Usage (Make.com Automation):');
console.log(`
// Simply POST your Notion data array directly:
fetch('https://customer-research-agent-nshlmp6pl-dexteryzs-projects.vercel.app/api/notion-data-import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(yourNotionDataArray) // Raw array from your automation
})
.then(res => res.json())
.then(data => {
  console.log('Success:', data.success);
  console.log('Message:', data.message);
  console.log('Transformed Data:', data.transformedData);
  console.log('Stats:', data.stats);
});
`);