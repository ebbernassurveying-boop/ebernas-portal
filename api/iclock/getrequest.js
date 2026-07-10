// api/iclock/getrequest.js — ZKTeco device command polling.
// Ang device ay regular na nagtatanong kung may command. Wala tayong command, "OK" lang.
export default function handler(req, res) {
  res.setHeader("Content-Type", "text/plain");
  return res.status(200).send("OK");
}
