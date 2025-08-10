interface NotionDataItem {
  id: string;
  created_time?: string;
  properties_value?: Record<string, unknown>;
  // Support new simplified format
  Name?: string;
  'AI summary'?: string;
  'Event time'?: string;
  'Meeting Type'?: string;
  'Meeting Notes'?: string;
}

interface TransformedFeedbackData {
  id: string;
  content: string;
  source: string;
  date: string;
  metadata: {
    meetingType: string;
    attendees: string[];
    eventTime: string;
    notionId: string;
  };
}

export function transformNotionToFeedbackData(
  notionData: NotionDataItem[]
): TransformedFeedbackData[] {
  return notionData
    .filter(item => {
      try {
        // Filter for customer meetings with AI summaries
        // Support both new simplified format and old complex format
        let meetingType: string | undefined;
        let hasAiSummary = false;
        
        if (item['Meeting Type']) {
          // New simplified format
          meetingType = item['Meeting Type'];
          hasAiSummary = Boolean(item['AI summary']);
        } else if (item.properties_value) {
          // Old complex format
          const meetingTypeProperty = item.properties_value["Meeting Type"] as Record<string, unknown>;
          meetingType = meetingTypeProperty?.name as string;
          const aiSummary = item.properties_value["AI summary"] as Array<unknown>;
          hasAiSummary = Boolean(aiSummary && aiSummary.length > 0);
        }
        
        return meetingType === "Customer Call" && hasAiSummary;
      } catch (error) {
        console.log('Error filtering item:', error, item);
        return false;
      }
    })
    .map(item => {
      try {
        // Handle different possible structures for Name - support both formats
        let name = "Untitled Meeting";
        if (item.Name) {
          // New simplified format
          name = item.Name;
        } else if (item.properties_value?.["Name"]) {
          // Old complex format
          const nameProperty = item.properties_value["Name"] as Array<Record<string, unknown>>;
          if (Array.isArray(nameProperty) && nameProperty[0]) {
            name = (nameProperty[0].plain_text as string) || 
                   (nameProperty[0].text as Record<string, unknown>)?.content as string || 
                   "Untitled Meeting";
          }
        }
        
        // Handle different possible structures for AI summary - support both formats
        let summary = "";
        if (item['AI summary']) {
          // New simplified format
          summary = item['AI summary'];
        } else if (item.properties_value?.["AI summary"]) {
          // Old complex format
          const summaryProperty = item.properties_value["AI summary"] as Array<Record<string, unknown>>;
          if (Array.isArray(summaryProperty)) {
            summary = summaryProperty
              .map(text => (text.plain_text as string) || 
                          (text.text as Record<string, unknown>)?.content as string || "")
              .join(" ");
          }
        }

        // Handle full meeting notes - support both formats
        let fullNotes = "";
        if (item['Meeting Notes']) {
          // New simplified format
          fullNotes = item['Meeting Notes'];
        } else if (item.properties_value) {
          // Old complex format - check multiple possible property names
          const possibleNotesProperties = [
            "Meeting Notes", "Notes", "Full Notes", "Meeting Content", 
            "Content", "Transcript", "Full Meeting Notes", "Body"
          ];
          
          for (const propName of possibleNotesProperties) {
            const notesProperty = item.properties_value[propName] as Array<Record<string, unknown>>;
            if (Array.isArray(notesProperty) && notesProperty.length > 0) {
              fullNotes = notesProperty
                .map(text => (text.plain_text as string) || 
                            (text.text as Record<string, unknown>)?.content as string || "")
                .join(" ");
              break; // Use the first property found
            }
          }
        }
        
        // Handle attendees - support both formats (simplified format may not have attendees)
        let attendees: string[] = [];
        if (item.properties_value?.["Attendees"]) {
          // Old complex format
          const attendeesProperty = item.properties_value["Attendees"] as Array<Record<string, unknown>> || [];
          attendees = attendeesProperty.map((attendee) => {
            return (attendee.person as Record<string, unknown>)?.email as string || 
                   attendee.name as string || "Unknown";
          });
        }
        // New simplified format doesn't include attendees, so we'll extract from name if needed
        if (attendees.length === 0 && name) {
          attendees = [name]; // Use meeting name as the attendee
        }

        // Handle event time - support both formats
        let eventTime = item.created_time || new Date().toISOString();
        if (item['Event time']) {
          // New simplified format
          eventTime = item['Event time'];
        } else if (item.properties_value?.["Event time"]) {
          // Old complex format
          const eventTimeProperty = item.properties_value["Event time"] as Record<string, unknown>;
          eventTime = (eventTimeProperty?.start as string) || eventTime;
        }

        // Get meeting type - support both formats
        let meetingType = "Unknown";
        if (item['Meeting Type']) {
          // New simplified format
          meetingType = item['Meeting Type'];
        } else if (item.properties_value?.["Meeting Type"]) {
          // Old complex format
          meetingType = (item.properties_value["Meeting Type"] as Record<string, unknown>)?.name as string || "Unknown";
        }

        // Combine meeting name, AI summary, and full notes for comprehensive content
        // Prioritize full notes if available, otherwise fall back to AI summary
        let content = `Meeting: ${name}\n\n`;
        if (fullNotes.length > 50) {
          content += `Full Meeting Notes:\n${fullNotes}`;
          if (summary.length > 0) {
            content += `\n\nAI Summary:\n${summary}`;
          }
        } else if (summary.length > 0) {
          content += `Summary: ${summary}`;
        } else {
          content += `No detailed content available.`;
        }

        return {
          id: item.id || `notion-${Date.now()}-${Math.random()}`, // Generate ID if not provided
          content,
          source: "notion_customer_call",
          date: eventTime,
          metadata: {
            meetingType,
            attendees,
            eventTime,
            notionId: item.id || `notion-${Date.now()}-${Math.random()}`
          }
        };
      } catch (error) {
        console.log('Error transforming item:', error, item);
        return null;
      }
    })
    .filter((item): item is TransformedFeedbackData => item !== null && item.content.length > 50); // Filter out nulls and very short summaries
}

export function createLLMAnalyzePayload(
  feedbackData: TransformedFeedbackData[],
  modes: string[] = ['painPoints', 'insights', 'recommendations', 'highlights'],
  userId?: string,
  fileId?: number
) {
  return {
    data: feedbackData,
    modes,
    userId,
    fileId
  };
}

export function formatMonthlyResearchPrompt(
  feedbackData: TransformedFeedbackData[],
  monthYear: string = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
): string {
  const callCount = feedbackData.length;
  const uniqueAttendees = new Set();
  
  feedbackData.forEach(item => {
    item.metadata.attendees.forEach(attendee => uniqueAttendees.add(attendee));
  });

  const dataContent = feedbackData.map(item => item.content).join("\n\n---\n\n");

  return `Review my customer meeting notes from ${monthYear} and write me a monthly client research report:

${dataContent}

Format this monthly client research report including the following sections:
* **tl;dr**
* **Insights Last Month**
  * Summary stats like ${callCount} calls, participant names: ${Array.from(uniqueAttendees).join(', ')}
  * Key insights broken down by pain points, blockers, customer requests, solution feedback
* **Next steps**
  * Suggested next steps to address client needs and/or enhance offering

Make sure to:
* Keep the report concise, factual, and easy-to-digest
* Avoid using markdown # in the output - change all instances to bold instead
* Do not be generic; focus each key insight and next step to be practical, specific, actionable, and helpful
* Focus next steps on improving our actual educational and community products:
  - Part-Time Consulting Launchpad: 8-week cohort program to launch your consulting side hustle and get your first client
  - Community Membership: Invite-only community for portfolio careerists to experiment, learn, and grow together`;
}