const payload = {
  conditions: {
    startTime: '10:00',
    endTime: '16:00',
    departurePlace: '自宅',
    budget: '15000',
    transport: '車',
    specialRequests: '',
  },
  participants: [],
};

async function main() {
  const response = await fetch('http://localhost:3001/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  console.log('=== response from server ===');
  console.log(JSON.stringify(json, null, 2));
  for (const plan of json.plans ?? []) {
    console.log('---', plan.id, '---');
    console.log('has localEnjoymentTime:', 'localEnjoymentTime' in plan, plan.localEnjoymentTime);
    console.log('has roundTripTime:', 'roundTripTime' in plan, plan.roundTripTime);
    console.log('has withinBudget:', 'withinBudget' in plan, plan.withinBudget);
    console.log('timeline length:', Array.isArray(plan.timeline) ? plan.timeline.length : 'MISSING');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
