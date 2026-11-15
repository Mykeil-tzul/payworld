export const scenarios={
  approve:["Approved","Issuer approves the request. Explore capture, clearing, and settlement next."],
  decline:["Declined","Issuer declines the simulated purchase. No authorization hold is created."],
  timeout:["Timeout","The response is lost after the issuer decides. Resolve the original request before sending a new payment."],
  duplicate:["Duplicate request","The merchant receives the same response for a retry with the same operation key."],
  refund:["Refund","Follow an approved purchase through settlement, then issue a refund."]
};

export function create(amount,scenario){
  if (!Number.isSafeInteger(amount)||amount<1||amount>100000||!Object.hasOwn(scenarios,scenario)) throw Error("Invalid simulated purchase.");
  return {amount,scenario,status:"ready",events:[],ledger:[],keys:{},webhook:false,auths:0};
}
function event(s,from,to,title,detail) {
  s.events.push({sequence:s.events.length+1,from,to,title,detail});
}
function journal(s,phase,debit,credit) {
  s.ledger.push({phase,debit,credit,cents:s.amount});
}
function issuerResponse(s) {
  const denied=s.scenario==="decline";
  s.auths++;
  event(s,"issuer","visa",denied?"Issuer declines":"Issuer approves",denied?"Fictional issuer decision: insufficient available funds.":"The issuer reserves the amount. Funds have not settled.");
  return denied ? "declined" : "authorized";
}
function returnResponse(s) {
  event(s,"visa","acquirer","Decision forwarded","The network routes the issuer’s response back to the acquirer.");
  event(s,"acquirer","merchant","Merchant receives response","The terminal can show the resulting payment status.");
}
export function allowed(state) {
  const next={ready:["authorize"],unknown:["resolve"],authorized:["capture"],captured:["clear"],cleared:["settle"],settled:["refund"],refund_pending:["refund_settle"]}[state.status]||[];
  return state.webhook ? [...next,"webhook"] : next;
}
export function apply(state,command,key=command) {
  if (typeof key!=="string" || key.length<1 || key.length>80 || !/^[a-zA-Z0-9_-]+$/.test(key)) throw Error("Invalid operation key.");
  const s=structuredClone(state);
  const prior=Object.hasOwn(s.keys,key) ? s.keys[key] : null;
  if (prior) {
    if (prior.command!==command) throw Error("The operation key was already used for a different command.");
    event(s,"merchant","acquirer","Duplicate request suppressed","Stored operation result: "+prior.status+". No additional issuer request or ledger entry.");
    return s;
  }
  if (!allowed(s).includes(command)) throw Error("This action is unavailable at the current stage.");
  switch(command) {
    case "authorize": {
      event(s,"cardholder","merchant","Myke initiates payment","Myke orders a vanilla cappuccino at the fictional Harbor Café.");
      event(s,"merchant","acquirer","Authorization submitted","The merchant passes purchase details to its acquirer through payment infrastructure.");
      event(s,"acquirer","visa","Network receives request","The acquirer sends the authorization request to the network.");
      event(s,"visa","issuer","Request routed to issuer","Visa connects the acquiring side with the bank that issued the card.");
      const status=issuerResponse(s);
      if (s.scenario==="timeout") {
        s.status="unknown";
        event(s,"visa","acquirer","Response not delivered","The merchant sees a timeout. In this simulation the issuer already approved.");
      } else {s.status=status;returnResponse(s);}
      break;
    }
    case "resolve":
      event(s,"merchant","acquirer","Original payment checked","The simulator resolves the original payment using its operation reference.");
      returnResponse(s);s.status="authorized";break;
    case "capture":
      event(s,"merchant","acquirer","Capture submitted","The merchant submits the approved amount for processing.");
      s.status="captured";break;
    case "clear":
      event(s,"acquirer","visa","Presentment submitted","Clearing communicates final transaction details.");
      event(s,"visa","issuer","Clearing record delivered","The issuer receives the transaction details for posting.");
      journal(s,"Clearing","Card receivable","Sales");
      s.status="cleared";break;
    case "settle":
      event(s,"issuer","acquirer","Settlement completed","In this simplified model, funds move between the issuing and acquiring sides.");
      event(s,"acquirer","merchant","Merchant payout recorded","Merchant-side journal matches the clearing receivable. Fees and netting are omitted.");
      journal(s,"Settlement","Cash","Card receivable");
      s.status="settled";s.webhook=true;break;
    case "refund":
      event(s,"merchant","acquirer","Refund submitted","The merchant requests a full credit for the original purchase.");
      event(s,"acquirer","visa","Credit routed","The network routes the refund record to the issuer.");
      event(s,"visa","issuer","Issuer receives credit","The original authorization and sale remain in the audit trail.");
      journal(s,"Refund","Sales returns","Refund payable");
      s.status="refund_pending";break;
    case "refund_settle":
      event(s,"issuer","cardholder","Refund completes","Simulated credit posts to the cardholder. Posting times vary in practice.");
      journal(s,"Refund settlement","Refund payable","Cash");
      s.status="refunded";break;
    case "webhook":
      event(s,"acquirer","merchant","Duplicate webhook ignored","A fictional payment service redelivers the settlement event. The consumer has already processed its event ID.");
      break;
  }
  s.keys[key]={command,status:s.status};
  if (command==="authorize" && s.scenario==="duplicate") return apply(s,command,key);
  return s;
}

export function reconcile(s) {
  const net=s.ledger.reduce((sum,row)=>sum+(row.debit==="Cash"?row.cents:row.credit==="Cash"?-row.cents:0),0);
  const expected=s.status==="settled"||s.status==="refund_pending"?s.amount:0;
  return {net,expected,matched:net===expected};
}
