/**
 * Site configuration — the only place you need to touch to go live.
 *
 * bookingEndpoint: POST URL that receives the qualifying answers, name, email and chosen slot
 *                  from the built-in booker (Make, Zapier, your CRM, your API…).
 * bookingUrl:      Or paste a Calendly / Cal.com / SavvyCal link: after the four questions the
 *                  visitor is sent there, with their answers added to the link.
 *
 * With neither set, `npm run dev` fakes a successful booking so the flow can be reviewed;
 * a production build tells the visitor booking isn't set up yet.
 */
export const CONFIG = {
  bookingEndpoint: '',
  bookingUrl: '',
};
