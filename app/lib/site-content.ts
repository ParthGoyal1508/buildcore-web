/**
 * Everything the public website says, in one place (053).
 *
 * The pages under `app/(site)/` only lay this out, so changing a phone number, adding a project or
 * filling in the management team is an edit here and nowhere else. The project lists and clients
 * come from the client's "Details Website" workbook; the prose is a draft for the client to approve.
 */

/** The production origin — used for the sitemap, robots.txt and link previews. */
export const SITE_URL = 'https://www.tirupatigroups.in';

export const COMPANY = {
  name: 'Tirupati Enterprises',
  tagline: 'Roads, highways and public buildings across Rajasthan',
  phones: ['+91 98280-31478', '01434-294329'],
  email: 'svkjain1975@gmail.com',
  registeredAddress:
    'Geeta Bhawan, Teli Mohalla, Near Suwalika Ice Factory, Deoli (Tonk) – 304804, Rajasthan',
  corporateOffice:
    'Tirupati House, Ward No. 13, Gaurav Path Road, Deoli (Tonk) – 304804, Rajasthan',
};

/** `footerOnly` pages are linked from the footer and the sitemap but left out of the header menu. */
export type NavItem = { label: string; href: string; children?: NavItem[]; footerOnly?: true };

export const NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'About Us',
    href: '/about',
    children: [
      { label: 'Vision & Mission', href: '/about#vision' },
      { label: 'HSE', href: '/about#hse' },
      { label: 'Our Strength', href: '/about#strength' },
    ],
  },
  {
    label: 'Verticals',
    href: '/verticals',
    children: [
      { label: 'Road', href: '/verticals#road' },
      { label: 'Highway', href: '/verticals#highway' },
      { label: 'Building', href: '/verticals#building' },
      { label: 'Operation & Maintenance', href: '/verticals#om' },
    ],
  },
  {
    label: 'Projects',
    href: '/projects',
    children: [
      { label: 'Completed Projects', href: '/projects#completed' },
      { label: 'Ongoing Projects', href: '/projects#ongoing' },
    ],
  },
  { label: 'Career', href: '/career', footerOnly: true },
  { label: 'Contact Us', href: '/contact' },
];

/** The website's own paths — the install-app offer stays off these (it is for the ERP). */
export const SITE_PATHS = NAV.map((item) => item.href);

export type VerticalKey = 'road' | 'highway' | 'building' | 'om';

export const VERTICALS: {
  key: VerticalKey;
  title: string;
  summary: string;
  body: string;
}[] = [
  {
    key: 'road',
    title: 'Road',
    summary: 'Widening, strengthening and urban road works.',
    body: 'We widen and strengthen district and major district roads, and build town roads complete with dividers, street lighting and beautification — work delivered for the Public Works Department and municipal bodies across Rajasthan.',
  },
  {
    key: 'highway',
    title: 'Highway',
    summary: 'State and national highway works.',
    body: 'From widening state highways to engineering measures for road safety and speed management, we deliver highway works to the specifications of state highway authorities and the Ministry of Road Transport & Highways.',
  },
  {
    key: 'building',
    title: 'Building',
    summary: 'Hospitals, police buildings and schools.',
    body: 'We construct public buildings — primary health centres, police stations, barracks, administrative blocks and school buildings — for state departments, built to last and handed over ready for use.',
  },
  {
    key: 'om',
    title: 'Operation & Maintenance',
    summary: 'Keeping highways safe and serviceable.',
    body: 'Under short-term maintenance contracts and long-term O&M agreements we keep national highway stretches safe, clean and serviceable — including the six-lane Jaipur Ring Road for NHAI.',
  },
];

export type Project = { name: string; client: string; vertical: VerticalKey };

const PWD = 'Public Works Department';
const MORTH = 'Ministry of Road Transport & Highways';
const HEALTH = 'Medical & Health Department';
const POLICE = 'Rajasthan State Police Department';

export const COMPLETED_PROJECTS: Project[] = [
  {
    name: 'Widening and strengthening of Suket – Ramganjmandi Road, km 0+400 to 7+000 (SH-9B), Kota (CRIF/1037/RJ/2023-24)',
    client: PWD,
    vertical: 'highway',
  },
  {
    name: 'Widening of road from Kota Road Chungi Office to Jahazpur Road (Ajmer Bypass), including divider, electric poles and beautification, Nagar Palika Deoli',
    client: 'Municipal Department',
    vertical: 'road',
  },
  {
    name: 'Construction of PHC building at Deoligaon (Block Deoli), District Tonk',
    client: HEALTH,
    vertical: 'building',
  },
  {
    name: 'Construction of PHC building at Ghar, District Tonk',
    client: HEALTH,
    vertical: 'building',
  },
  {
    name: 'Construction of PHC building at Kaleda Kanwar Ji, District Ajmer',
    client: HEALTH,
    vertical: 'building',
  },
  {
    name: 'STMC for Kota – Darah section, km 289+500 to 299+000 on NH-52, under STMC 2023-24, Rajasthan',
    client: MORTH,
    vertical: 'om',
  },
  {
    name: 'Engineering measures for speed management under the Pilot Speed Management Programme, Deoli – Nasirabad section of SH-26 (RSHDP-II), Rajasthan',
    client: 'Rajasthan State Highway Authority',
    vertical: 'highway',
  },
  {
    name: 'Widening of road from Jaipur Road Chungi Office to Daulta Mod, including divider, electric poles and beautification, Nagar Palika Deoli',
    client: 'Municipal Department',
    vertical: 'road',
  },
  {
    name: 'Construction of Mahila Police Thana, Tonk',
    client: POLICE,
    vertical: 'building',
  },
];

export const ONGOING_PROJECTS: Project[] = [
  {
    name: 'Construction of police station building at Karvar, District Bundi',
    client: POLICE,
    vertical: 'building',
  },
  {
    name: 'Construction of new school building, Govt. Senior Secondary School Dhunwala, Block Jahazpur',
    client: 'Samagra Shiksha Abhiyan',
    vertical: 'building',
  },
  {
    name: 'STMC for maintenance of km 289/500 to 299/0 on the Kota – Darah section of NH-52, Rajasthan',
    client: MORTH,
    vertical: 'om',
  },
  {
    name: 'Construction of 100-women barrack at Police Line, Jhalawar',
    client: POLICE,
    vertical: 'building',
  },
  {
    name: 'Construction of administrative block of Cyber Thana, District Jhalawar',
    client: POLICE,
    vertical: 'building',
  },
  {
    name: 'Widening and strengthening of Kherbad – Goyanda Road, km 0/0 to 7/500',
    client: PWD,
    vertical: 'road',
  },
  {
    name: 'Widening and strengthening of Amjhar – Khedli – Chechat – Madanpur road, km 15/0 to 33/500, District Kota',
    client: PWD,
    vertical: 'road',
  },
  {
    name: 'Operation and maintenance of 6-lane Jaipur Ring Road (Southern Corridor), km 0.300 to 46.700 on NH-148C (46.400 km), Rajasthan',
    client: 'National Highways Authority of India',
    vertical: 'om',
  },
  {
    name: 'Widening and strengthening of NH-52 (Deva Khera) to NH-148D (Dhor) road, km 0/0 to 22/0 (MDR-419), CRIF/1167/RJ/2025-26',
    client: PWD,
    vertical: 'road',
  },
];

/** In the order the client listed them; logos are in `public/site/clients/`. */
export const CLIENTS: { name: string; logo: string }[] = [
  { name: 'National Highways Authority of India', logo: 'nhai.png' },
  { name: 'Ministry of Road Transport & Highways', logo: 'morth.png' },
  { name: 'Public Works Department, Rajasthan', logo: 'pwd-rajasthan.png' },
  { name: 'RSRDC', logo: 'rsrdc.jpg' },
  { name: 'Medical & Health Department', logo: 'health.png' },
  { name: 'Education Department, Rajasthan', logo: 'education.jpg' },
  { name: 'IRB Infrastructure Developers', logo: 'irb.png' },
  { name: 'Modern Road Makers', logo: 'mrm.jpg' },
  { name: 'Montecarlo Ltd', logo: 'montecarlo.png' },
  { name: 'Adani', logo: 'adani.png' },
  { name: 'Cemindia', logo: 'cemindia.png' },
  { name: 'PNC Infratech', logo: 'pnc.png' },
  { name: 'G R Infraprojects', logo: 'gr-infra.png' },
  { name: 'Patel Infrastructure', logo: 'patel.png' },
  { name: 'MKC Infrastructure', logo: 'mkc.jpg' },
  { name: 'DRAIPL', logo: 'dra.png' },
];

export const JOURNEY = [
  'Tirupati Enterprises began in Deoli, District Tonk, as a civil contractor serving the town and the district around it. Town roads for Nagar Palika Deoli and primary health centres for the Medical & Health Department were among the first works that built our name for finishing on time and to specification.',
  'From there we grew into state highway and national highway work — widening state highways for the Public Works Department, carrying out road-safety engineering for the Rajasthan State Highway Authority, and maintaining stretches of NH-52 for the Ministry of Road Transport & Highways.',
  'Today we deliver roads, highways, public buildings and highway maintenance across Rajasthan, including the operation and maintenance of the six-lane Jaipur Ring Road for NHAI, and we work alongside the country’s leading infrastructure developers.',
];


export const VISION =
  'To be Rajasthan’s most trusted infrastructure partner — known for roads, highways and public buildings that are delivered on time, built to last and safe for everyone who uses them.';

export const MISSION = [
  'Deliver every project to specification, on schedule and within budget.',
  'Put the safety of our people and the public first, on every site, every day.',
  'Invest in modern plant, skilled people and sound engineering practice.',
  'Build long-term relationships with our clients through transparency and reliability.',
];

export const HSE = {
  intro:
    'Health, safety and the environment are part of how we plan and run every site — not an afterthought.',
  points: [
    {
      title: 'Health',
      body: 'Clean drinking water, first aid and regular health checks for our workforce at every site.',
    },
    {
      title: 'Safety',
      body: 'Personal protective equipment, toolbox talks before work and proper traffic management on live roads.',
    },
    {
      title: 'Environment',
      body: 'Dust and noise control, responsible disposal of waste and care for the communities we work in.',
    },
  ],
};

export const STRENGTHS = [
  {
    title: 'Proven delivery',
    body: 'A record of completed roads, highways and public buildings for central and state government departments.',
  },
  {
    title: 'Own plant & machinery',
    body: 'An owned fleet of construction equipment, so work keeps moving without waiting on hire.',
  },
  {
    title: 'Experienced people',
    body: 'Engineers, supervisors and a skilled workforce who know Rajasthan’s terrain and conditions.',
  },
  {
    title: 'Trusted partners',
    body: 'Repeat work for NHAI, MoRTH, PWD and leading developers such as IRB, PNC, G R Infra and Adani.',
  },
];

