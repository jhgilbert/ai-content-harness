import type { PresidentDescriptionInput } from "./schema.ts";

export const example: PresidentDescriptionInput = {
  name: "George Washington",
  pronoun: "he",
  numbers: [1],
  summary:
    "He led the Continental Army to victory in the American Revolutionary War, presided over the Constitutional Convention, and set many of the precedents that shaped the presidency.",
  born: "1732-02-22",
  died: "1799-12-14",
  terms: [
    { start: "1789-04-30", end: "1793-03-04", vicePresidents: ["John Adams"] },
    { start: "1793-03-04", end: "1797-03-04", vicePresidents: ["John Adams"] },
  ],
  knownFor: [
    {
      name: "Revolutionary War",
      description:
        "Commanded the Continental Army from 1775 to 1783, including the crossing of the Delaware River and the victory at Yorktown",
    },
    {
      name: "Giving up power",
      description:
        "Resigned his military commission in 1783 rather than keep control of the army, and left the presidency after two terms",
    },
    {
      name: "Unanimous elections",
      description: "The only president elected unanimously by the Electoral College, which he did twice",
    },
    {
      name: "Farewell Address",
      description: "Warned against political parties and permanent foreign alliances in 1796",
    },
  ],
  timeline: [
    {
      year: 1732,
      event: "Born at Popes Creek, Virginia, to Augustine and Mary Ball Washington",
    },
    {
      year: 1749,
      event: "Became the surveyor of Culpeper County, Virginia, at age 17",
    },
    {
      year: 1754,
      event: "Fought in the first battles of the French and Indian War",
    },
    {
      year: 1759,
      event: "Married Martha Dandridge Custis and joined the Virginia House of Burgesses",
    },
    { year: 1775, event: "Named commander in chief of the Continental Army" },
    {
      year: 1781,
      event: "Defeated the British army at Yorktown with French support",
    },
    {
      year: 1787,
      event: "Presided over the Constitutional Convention in Philadelphia",
    },
    { year: 1789, event: "Inaugurated as the 1st president in New York City" },
    {
      year: 1796,
      event: "Published his Farewell Address and declined a third term",
    },
    { year: 1799, event: "Died at Mount Vernon" },
  ],
};
