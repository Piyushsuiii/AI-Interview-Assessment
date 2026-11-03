# AI Hiring Intelligence Platform

## Report Draft: Abstract, Introduction, Chapter 1 and Chapter 2

**Formatting note:** Insert a page break at every `PAGE BREAK` marker. In Microsoft Word, use Times New Roman, 12-point body text, 1.5 line spacing, justified alignment, and the heading styles prescribed by the university template. With standard A4 margins, each section below is designed to occupy approximately one page; final pagination may vary slightly after the title styles and institutional margins are applied.

## Abstract

Recruitment involves reviewing large volumes of candidate information, conducting consistent assessments, and making decisions that can be explained to both organizations and applicants. Conventional workflows often distribute these activities across applicant records, interviews, coding tools, spreadsheets, and email. This fragmentation increases administrative work and can make candidate comparisons inconsistent. The **AI Hiring Intelligence Platform** was developed as a unified, multi-tenant web application that supports recruiters and candidates throughout a structured technical hiring process.

The platform enables an organization to create jobs, define required skills, construct versioned assessments, invite candidates, conduct adaptive interviews, execute coding exercises, collect system-design responses, and generate evidence-linked evaluations. A dedicated candidate portal provides passwordless access, interview progress, profile and resume management, and privacy-request functions. Resume intelligence is provided by CVerify, a locally hosted DistilBERT classifier trained to assign resumes to 24 job families. In held-out evaluation, the selected checkpoint achieved 86.35% accuracy, 85.36% weighted F1-score, and 79.47% macro F1-score. Text extraction uses PyMuPDF, with optional optical character recognition for image-only pages.

The solution follows a modular architecture. Next.js provides the user interface, NestJS exposes versioned application programming interfaces, PostgreSQL and Prisma maintain authoritative records, Redis and BullMQ support background work, and a separate worker executes candidate code inside restricted Docker containers. OpenAI and Gemini providers are accessed through a validated server-side gateway with fallback handling and usage records. Security controls include HTTP-only authentication cookies, role-based permissions, organization-scoped database queries, hashed invitation tokens, immutable assessment snapshots, audit logs, and separation between recruiter and candidate sessions. Automated unit, integration, and browser tests verify the major workflows.

The project demonstrates that artificial intelligence can assist rather than replace professional judgement. Recommendations remain reviewable, supporting evidence is retained, and recruiters can override outcomes with a recorded reason. The resulting system improves workflow consistency, traceability, and candidate access while recognizing that production adoption also requires continuous validation, bias monitoring, privacy governance, and human oversight.

**Keywords:** artificial intelligence, recruitment, adaptive interview, resume classification, DistilBERT, candidate assessment, explainable evaluation, multi-tenant SaaS.

<!-- PAGE BREAK -->

## Introduction

Recruitment is a high-impact organizational process because the quality of hiring decisions affects productivity, team capability, employee retention, and long-term competitiveness. At the same time, employers must evaluate growing and increasingly diverse applicant pools while offering candidates a timely and fair experience. The World Economic Forum reports that skill requirements are changing rapidly as organizations adopt artificial intelligence, information-processing technologies, and automation [1]. Consequently, recruitment systems must evaluate demonstrable skills and learning ability instead of relying only on job titles, keywords, or unstructured impressions.

Digital applicant-tracking systems improved record management, but many hiring workflows remain fragmented. A recruiter may define a role in one system, screen resumes in another, conduct interviews through video calls, assess code on a separate website, and consolidate conclusions manually. Unstructured interviews also allow different candidates to receive different questions, reducing comparability. Research has consistently shown the value of structure, job-related criteria, and standardized scoring in personnel selection [2], [3]. Artificial intelligence can help apply these principles by generating role-aligned content, adapting follow-up questions within controlled limits, summarizing evidence, and automating repetitive administration. However, automated hiring also creates risks involving discrimination, opacity, privacy, security, and over-reliance on model output [4], [5].

This project addresses both the operational opportunity and the governance challenge through an **AI Hiring Intelligence Platform**. The platform combines job and assessment management, candidate invitations, resume classification, adaptive interviewing, coding and system-design exercises, evidence-based evaluation, reporting, and candidate self-service in one application. It serves two principal groups. Recruiters need a consistent workflow and decision-support information, while candidates need clear access, saved progress, privacy controls, and an assessment that is relevant to the role. The system therefore separates recruiter and candidate authentication, applies organization-level authorization, and limits candidate interfaces to information appropriate for the applicant.

The platform is intentionally designed as a decision-support tool rather than an autonomous hiring authority. AI responses are validated before persistence, evaluations cite stored answers or submissions, and human users retain control over final recommendations. This approach is consistent with the NIST AI Risk Management Framework, which emphasizes validity, transparency, accountability, privacy, and ongoing risk management [6]. The following chapters establish the project's motivation, objectives, scope, plan, and academic context. Later chapters can describe the detailed requirements, system design, implementation, testing, results, and future development.

<!-- PAGE BREAK -->

# Chapter 1: Introduction

## 1.1 Background and Motivation

Organizations increasingly compete on their ability to identify skills and place suitable people in suitable roles. This task is becoming more difficult because technologies and occupational requirements change faster than traditional recruitment processes. The *Future of Jobs Report 2025* identifies technological change, including artificial intelligence and information processing, as a major force reshaping jobs and skill demand [1]. Employers therefore need assessment methods that can examine current competence, practical problem solving, and adaptability. A resume alone cannot provide sufficient evidence for all these qualities, particularly in technical recruitment.

Existing recruitment processes commonly contain several disconnected stages. Recruiters write job descriptions, inspect resumes, arrange interviews, send coding exercises, collect interviewer notes, and prepare comparison reports. When each activity uses a different tool, information must be transferred manually and decision history becomes difficult to audit. Different interviewers may also ask different questions or apply different standards. Structured interviews address part of this problem by using job-related questions and defined evaluation criteria. Campion, Palmer, and Campion describe structure as a collection of practices that improve consistency, reliability, and validity [2]. Meta-analytic research has likewise shown that structured selection methods provide stronger evidence than informal judgement alone [3].

Artificial intelligence offers useful support at several points in this process. Natural-language models can analyze a job description, suggest competencies, create questions, generate bounded follow-ups, and summarize candidate evidence. Transformer models can classify resume text by job family and assist initial organization of applicant data. However, speed is not the only requirement. Hiring decisions affect access to employment, so an AI-supported platform must address fairness, explainability, data protection, and human accountability. Research on algorithmic recruitment warns that biased historical data, unsuitable proxy variables, and weak validation can reproduce or amplify discrimination [4], [5]. The European Union's AI Act accordingly treats specified employment-related AI systems as high-risk and establishes obligations concerning risk management, data governance, documentation, human oversight, and performance [7].

The motivation for this project is therefore to combine workflow efficiency with responsible system design. The proposed platform does not merely produce an unexplained score. It stores immutable question versions, candidate answers, code-execution results, system-design submissions, integrity events, competency scores, model metadata, and supporting quotations. Recruiters can inspect reports and override recommendations while recording a reason. Candidates receive a separate portal with passwordless authentication, saved interview progress, resume controls, and mechanisms to request data export or deletion.

Technically, the project also responds to the need for a practical, scalable architecture. The application separates the web interface, API, AI gateway, database, background queue, code-execution worker, and resume-classification service. This separation limits security exposure and permits individual components to be tested and deployed independently. The central motivation is thus not to remove people from recruitment, but to give people a more consistent, evidence-oriented, secure, and manageable process.

<!-- PAGE BREAK -->

## 1.2 Problem Identification

The project began by examining the recruitment journey from the perspectives of recruiters, hiring managers, interviewers, candidates, and system administrators. No primary questionnaire is claimed in this report; the need assessment is based on stakeholder workflow analysis, inspection of common recruitment activities, and findings reported in selection and algorithmic-hiring literature. This distinction is important because presenting invented survey responses would weaken the validity of the study. A structured user survey can be conducted during a later organizational pilot.

The central problem is that technical hiring requires several types of evidence, but conventional processes rarely manage them in a single controlled workflow. Resume review may identify experience keywords but cannot prove coding ability. A conversational interview may reveal reasoning but can vary significantly between interviewers. A coding score may show whether tests passed but may not explain the candidate's design choices. Recruiters must manually connect these fragments before reaching a decision. This consumes time and creates opportunities for missing information, inconsistent criteria, and subjective interpretation.

Five specific problem areas were identified. First, **workflow fragmentation** causes repeated data entry and weak traceability between a job requirement, assessment question, candidate answer, and final recommendation. Second, **inconsistent assessment** occurs when candidates receive different questions or when interviewers use undefined scoring standards. Third, **limited evidence visibility** occurs when a final score is presented without the answer, code, test result, or rationale that produced it. Fourth, **candidate-access problems** occur when invitation links, progress, personal data, and completed interviews are not available through a secure self-service area. Fifth, **AI and data-governance risks** arise when automated recommendations are opaque, sensitive data crosses uncontrolled boundaries, or a model is treated as the final decision-maker.

These issues define the core problem statement: **How can a secure web platform integrate resume intelligence, structured adaptive interviews, practical technical assessments, and explainable AI-assisted evaluation while preserving human oversight and candidate privacy?** The question requires more than a chat interface or resume parser. It requires identity separation, tenant isolation, versioned content, controlled AI outputs, secure code execution, recoverable interview state, and evidence-grounded reporting.

The implemented solution addresses this problem through a unified data model and bounded automation. Every organization owns its jobs, candidates, assessments, interviews, and reports. Published assessment content is versioned so that later editing does not change an interview retrospectively. Adaptive follow-ups are limited and use deterministic fallback behaviour when AI output is invalid or unavailable. Candidate code runs outside the API in temporary Docker containers with networking disabled and resource limits applied. AI evaluations are validated against a schema and linked to stored evidence. These controls transform a broad recruitment problem into testable system requirements without claiming that software can independently determine a person's suitability for employment.

<!-- PAGE BREAK -->

## 1.3 Project Objectives

The principal objective of the project is to design and implement a secure, AI-assisted hiring platform that makes technical recruitment more structured, traceable, and manageable for recruiters while providing candidates with a clear and resilient assessment experience. The platform must support the complete path from role definition to evidence-based review without allowing artificial intelligence to become an unaccountable final decision-maker.

The specific objectives are as follows:

1. **Centralize recruitment activities.** The system should manage organizations, team memberships, jobs, skills, candidates, assessments, interviews, evaluations, reports, notifications, usage, and audit information through one consistent application and relational data model.

2. **Support structured, job-related assessment.** Recruiters should be able to define technical, coding, behavioural, scenario, and system-design questions with difficulty, expected responses, scoring rubrics, weights, and required skills. Published assessments should be versioned so that each candidate is evaluated against an identifiable configuration.

3. **Provide controlled AI assistance.** AI should assist job analysis, question generation, bounded follow-up generation, and evidence-based evaluation. Provider responses must follow validated structures, record model and prompt metadata, and fail safely through provider fallback or deterministic behaviour.

4. **Evaluate practical technical capability.** Candidates should be able to submit JavaScript, TypeScript, or Python solutions and receive results from public and hidden tests. Untrusted code must execute in isolated containers rather than in the browser or main API process. System-design tasks should also collect a diagram and written explanation.

5. **Introduce resume intelligence.** The CVerify service should extract text from PDF resumes and classify each document into one of 24 job families. Model performance must be measured on held-out documents, and document-level dataset splitting must prevent chunks from the same resume appearing in training and test data.

6. **Make evaluation explainable and reviewable.** Reports should include competency-level scores, confidence, strengths, weaknesses, supporting evidence, and a recommendation. Recruiters must be able to inspect interview history and override a recommendation with a recorded justification.

7. **Protect users and organizational data.** The system should use secure cookies, hashed tokens, role-based access control, tenant-scoped queries, audit logs, request validation, restricted file handling, and separate candidate and recruiter sessions. Candidate interfaces must not reveal internal rubrics, hidden tests, integrity details, or private recommendations.

8. **Deliver a usable and testable application.** Recruiter and candidate workflows should operate on desktop and mobile screens, preserve interview progress, and provide clear status feedback. Automated unit, integration, and browser tests should verify critical authentication, authorization, interview, AI, and portal behaviour.

These objectives are measurable through implemented features, database constraints, security behaviour, model evaluation metrics, and automated verification. They establish a realistic boundary: the system improves the quality and consistency of information available to decision-makers, but organizational users remain responsible for lawful and fair hiring decisions.

<!-- PAGE BREAK -->

## 1.4 Project Timeline

The project was organized as an iterative sixteen-week development plan. Iteration was necessary because authentication, assessment design, interview progression, AI evaluation, and reporting are tightly connected. Each phase produced a testable increment and reduced the risk of discovering architectural problems only at the end. Security and testing were treated as continuous activities rather than final additions.

| Phase | Weeks | Main activities | Main deliverables |
|---|---:|---|---|
| Problem definition and research | 1-2 | Stakeholder analysis, literature review, risk identification, project scope | Problem statement, objectives, initial requirements |
| Architecture and data design | 3-4 | Monorepo structure, service boundaries, database entities, API conventions | Architecture model, Prisma schema, development environment |
| Recruiter foundation | 5-6 | Authentication, organization membership, roles, jobs, candidates | Secure recruiter access and tenant-scoped job pipeline |
| Assessment management | 7-8 | Question bank, assessment versions, publishing, invitations | Repeatable and immutable assessment workflow |
| Candidate interview flow | 9-10 | Consent, interview state, answer persistence, reconnect support, adaptive follow-ups | Resumable structured interview experience |
| Practical assessment | 11 | Coding queue and worker, Docker restrictions, system-design canvas | Isolated coding and design submissions |
| AI evaluation and reports | 12-13 | AI gateway, schema validation, evidence mapping, reports, comparison | Reviewable competency evaluation and recommendations |
| Candidate portal and resume AI | 14 | Passwordless access, privacy controls, CVerify training and integration | Candidate self-service and 24-class resume analysis |
| Hardening and verification | 15 | Authorization review, browser testing, migration checks, responsive testing | Correctness, security, and usability fixes |
| Documentation and report | 16 | Results consolidation, limitations, academic report preparation | Final system and project documentation |

The timeline also reflects important dependencies. The relational model and authorization rules had to precede feature development because every later workflow depends on correct ownership and identity boundaries. Assessment versioning had to be completed before interview sessions, because an active interview must preserve the exact question content seen by a candidate. Similarly, the code worker was separated from the API before coding assessments were exposed, preventing unsafe direct execution from becoming an embedded design assumption.

Verification occurred throughout the plan. Service-level tests covered authentication, authorization, AI routing, interview state, report generation, billing, and candidate functions. Browser tests checked important recruiter and candidate journeys at desktop and mobile dimensions. Database migrations were applied incrementally. For CVerify, the baseline was preserved, documents were split before token chunking, candidate checkpoints were compared using validation F1-score, and the selected model was evaluated on a held-out test set. This phased plan made progress observable while keeping high-risk components, particularly identity, AI output, and code execution, under continuous review.

<!-- PAGE BREAK -->

## 1.5 Project Scope

The project scope includes the design, implementation, and local verification of a multi-tenant software-as-a-service platform for structured technical hiring. On the recruiter side, the system includes account access, organization membership, role-based permissions, job and skill management, candidate pipelines, question management, versioned assessments, invitation links, interview monitoring, notifications, evaluations, candidate comparisons, reports, recommendation overrides, usage controls, and an organization-grounded recruiter assistant. On the candidate side, it includes passwordless sign-in, profile management, resume management, interview access, consent, saved progress, text responses, coding exercises, system-design submissions, completed-interview visibility, data export requests, and deletion requests.

The AI scope covers four controlled areas. First, language models assist in analyzing a role and identifying relevant competencies. Second, they can help create assessment content. Third, an interview may insert a bounded follow-up question based on a submitted answer. Fourth, structured evaluation generates competency findings and connects them to stored evidence. AI calls occur through a server-side provider gateway that validates output and records usage metadata. Resume intelligence is supplied separately by CVerify, a DistilBERT-based service that classifies PDF resumes into 24 job families. These capabilities provide decision support; they do not issue employment offers, reject candidates automatically, or remove the requirement for recruiter review.

The technical scope includes a Next.js web application, a NestJS REST API, PostgreSQL persistence through Prisma, Redis-backed BullMQ processing, a Docker-isolated code worker, and a Python FastAPI inference service. Authentication, tenant isolation, hashed invitation credentials, audit records, immutable content snapshots, and evidence records form part of the implemented scope. The project also includes automated tests, schema migrations, developer documentation, and target deployment guidance.

Several items are outside the present scope. Video interviewing and biometric emotion analysis are not implemented. The system does not claim to infer personality, honesty, protected characteristics, or future job performance from a person's face or voice. Production-scale observability, application container images, and production cloud orchestration remain future work. Resume object storage is architecturally supported but is disabled until a production storage provider is configured. Live passwordless email delivery similarly depends on external mail credentials. Although Stripe-related subscription flows exist, a production payment account and commercial launch are not part of this academic implementation.

The project also does not establish legal compliance merely by implementing technical controls. An adopting organization would still need a lawful basis for processing, retention policies, accessibility review, bias and adverse-impact monitoring, candidate notices, model-change governance, and jurisdiction-specific legal assessment. These boundaries keep the project technically meaningful while avoiding unsupported claims about autonomous hiring accuracy or universal regulatory compliance.

<!-- PAGE BREAK -->

# Chapter 2: Literature Survey

## 2.1 Review of Existing Work

Research relevant to the project can be divided into personnel selection, digital recruitment, natural-language processing, algorithmic decision support, and responsible AI governance. Personnel-selection literature provides the foundation. Structured interviews use consistent, job-related questions and predetermined scoring guidance. Campion et al. identify multiple components of interview structure, including standardized questions, limited prompting, anchored rating scales, and interviewer training [2]. Schmidt and Hunter's review of selection methods demonstrates why decisions should use validated evidence rather than confidence in informal judgement [3]. These findings directly support the platform's question versions, rubrics, competency scores, and comparable candidate reports.

Digital recruitment research considers how technology changes both organizational efficiency and applicant experience. Black and van Esch describe AI-enabled recruiting as a combination of sourcing, screening, engagement, and selection support while stressing the importance of appropriate design and acceptance [8]. Woods et al. observe that digital selection can improve reach and process efficiency, but its value depends on psychometric quality, applicant reactions, and implementation context [9]. Gilliland's model of applicant reactions further explains that procedural justice, job relatedness, information, and respectful treatment influence how selection systems are perceived [10]. These studies justify a candidate portal that provides clear status, consent, recoverable progress, and controlled access to personal information.

Natural-language processing supplies methods for interpreting jobs, resumes, and interview text. BERT introduced deep bidirectional transformer pre-training that can be fine-tuned for classification tasks [11]. DistilBERT reduces model size through knowledge distillation while retaining much of BERT's language capability [12]. This makes it suitable for a local resume-classification service where inference cost, privacy, and deployment simplicity are relevant. Nevertheless, resume classification is only a categorization aid; it cannot establish an individual's competence or suitability by itself.

The literature also documents substantial risk. Köchling and Wehner's systematic review finds that algorithmic decision-making in recruitment and human-resource development can produce discrimination through data, feature selection, and model design [4]. Raghavan et al. show that vendor claims about bias mitigation often lack consistent definitions, documentation, and independent validation [5]. These concerns support evidence retention, model metadata, human review, and careful separation of candidate-visible and internal information.

Governance frameworks convert these concerns into operational expectations. NIST's AI Risk Management Framework organizes work around governing, mapping, measuring, and managing AI risk [6]. The EU AI Act establishes risk-based duties for relevant employment AI [7], while the United States Equal Employment Opportunity Commission warns that software selection procedures can create unlawful adverse impact [13]. Existing work therefore supports AI assistance only when combined with structure, validation, transparency, security, monitoring, and accountable human decision-making.

<!-- PAGE BREAK -->

## 2.2 Critical Analysis of Literature

The reviewed literature provides strong support for structured assessment but does not justify assuming that every automated tool improves hiring. A central strength of structured interviews is comparability: candidates are evaluated on criteria derived from the role rather than solely on an interviewer's preferred conversation [2]. However, excessive standardization can ignore relevant differences in experience and may prevent useful clarification. The platform responds by keeping a stable assessment core while permitting a bounded adaptive follow-up. This balances consistency and individual exploration, although the effect of adaptive questions on score comparability should be validated in future field studies.

AI-enabled recruitment literature frequently emphasizes speed, scale, and improved candidate matching [8]. These benefits are plausible, especially for drafting material, organizing information, and summarizing evidence. Yet efficiency metrics do not prove selection validity. A fluent language-model explanation may appear authoritative even when it is unsupported. For this reason, the implemented evaluation schema requires evidence connected to stored answers, questions, code, or design work. Output validation and provider fallback improve technical reliability, but they do not prove that a score predicts job performance. Criterion-related validation using later workplace outcomes would be required before such a claim could be made.

Resume classifiers illustrate a similar limitation. Transformer architectures such as BERT and DistilBERT perform well on text-classification tasks [11], [12], and local inference can reduce unnecessary transfer of candidate documents to external services. Nevertheless, accuracy alone can conceal weak performance for less frequent categories. Macro F1-score is therefore reported alongside accuracy and weighted F1-score in this project. Dataset leakage is another serious methodological risk: if chunks from one resume appear in both training and testing, results may be overstated. CVerify splits at the document level before producing overlapping chunks. Even with these controls, a predicted job family is descriptive metadata and must not be treated as a hiring recommendation.

Fairness research reveals a gap between commercial claims and available evidence. Bias cannot be solved only by removing obvious protected attributes, because education, location, employment gaps, and language patterns can operate as proxies [4], [5]. A technically accurate model may still create unequal selection rates or disadvantage candidates with disabilities, non-standard career histories, or limited access to technology. Meaningful governance therefore requires subgroup testing, accessible alternatives, appeal mechanisms, data-quality review, and monitoring after deployment. These activities depend on organizational policy and representative data; they cannot be guaranteed by application code alone.

Finally, regulation and governance frameworks provide necessary controls but not a universal checklist. The NIST framework is voluntary and contextual [6]. Legal requirements vary by jurisdiction, and the EU AI Act's obligations depend on the system's role and deployment context [7]. The literature therefore leads to a cautious conclusion: AI can strengthen recruitment administration and evidence handling, but final decisions need trained human oversight, documented purpose, ongoing validation, candidate communication, and the ability to question or override automated output.

<!-- PAGE BREAK -->

## 2.3 Bibliometric Analysis

The literature survey used a structured thematic search rather than claiming a full database-export bibliometric study. Sources were identified through combinations of terms such as *artificial intelligence recruitment*, *algorithmic hiring bias*, *structured interview validity*, *digital personnel selection*, *BERT resume classification*, *applicant reactions*, *AI risk management*, and *employment AI regulation*. Priority was given to peer-reviewed journal articles, influential conference papers, official standards, and primary regulatory publications. The selected works span foundational personnel-selection research and recent AI-governance developments.

| Theme | Representative sources | Main concepts | Relevance to the project |
|---|---|---|---|
| Structured selection | Campion et al. [2]; Schmidt and Hunter [3] | Standardized questions, scoring anchors, validity | Versioned questions, rubrics, comparable reports |
| Applicant experience | Gilliland [10]; Woods et al. [9] | Procedural justice, job relatedness, digital access | Consent, clear workflow, saved progress, candidate portal |
| AI recruitment | Black and van Esch [8]; Tambe et al. [14] | Automation, augmentation, adoption challenges | AI assistance with retained human control |
| NLP and transformers | Devlin et al. [11]; Sanh et al. [12] | Pre-training, fine-tuning, knowledge distillation | CVerify resume classification service |
| Bias and accountability | Köchling and Wehner [4]; Raghavan et al. [5] | Proxy bias, weak audits, documentation gaps | Evidence links, model records, overrides, future monitoring |
| Governance and law | NIST [6]; EU [7]; EEOC [13] | Risk management, high-risk AI, adverse impact | Risk controls, access control, logs, human oversight |

Three patterns emerge from this mapping. First, research has moved from isolated questions of selection validity toward socio-technical analysis. Recent work examines not only whether an assessment predicts performance, but also who is affected, how the model was developed, what evidence is available, and how a decision can be challenged. Second, there is increasing convergence around **human-centred augmentation**. AI is most defensible when it organizes information and supports a responsible professional rather than making an irreversible employment decision independently. Third, documentation and monitoring have become core design concerns. Model identity, prompt version, confidence, evidence, overrides, and audit events are not secondary administrative details; they are necessary for evaluation and governance.

The source distribution also reveals limitations. Much peer-reviewed work evaluates narrow tools, hypothetical scenarios, or vendor descriptions rather than complete, long-running recruitment deployments. Studies use different definitions of fairness and different outcome measures, which restrict direct comparison [5]. Rapid changes in generative AI also mean that technical capability evolves faster than longitudinal evidence. Consequently, this project's design decisions are grounded in recurring principles across the literature, while performance claims remain limited to directly measured software and classifier results. A future full bibliometric analysis could export records from Scopus or Web of Science, document inclusion criteria, remove duplicates, and use VOSviewer or Bibliometrix to quantify publication trends, co-authorship, citations, and keyword co-occurrence.

<!-- PAGE BREAK -->

## 2.4 Research Gap

Existing scholarship and products address many parts of recruitment, but several gaps remain when these parts are considered as one accountable workflow. Personnel-selection research provides strong guidance on structure and validity, while natural-language processing research provides effective classification and generation methods. Recruitment platforms offer applicant tracking, coding websites offer technical tests, and generative AI tools can summarize text. However, these capabilities are often separated. The connection between a job requirement, a specific version of an assessment, the candidate's submitted evidence, an AI-generated competency finding, and the recruiter's final action may not remain visible in one system.

The first research gap is therefore **end-to-end evidence traceability**. Many systems display a score without preserving a clear path to the exact answer, code execution, design submission, scoring rationale, and model version behind it. This limits review and makes errors harder to identify. The proposed platform stores immutable question snapshots and links competency findings to evidence, enabling a reviewer to move from recommendation back to source material.

The second gap is **controlled adaptivity**. Fully static interviews improve comparability but may fail to explore an unclear or promising response. Unrestricted generative interviews can vary too widely and may ask irrelevant or unsafe questions. The project explores a middle position: a stable, versioned assessment with a limited follow-up generated under a defined contract and replaced by deterministic fallback behaviour when generation fails. This design requires future empirical evaluation, but it establishes a technical mechanism for balancing consistency and responsiveness.

The third gap is **integration of practical assessment with AI interpretation**. Resume categorization, conversational answers, code tests, and system-design work represent different forms of evidence. Treating any single form as conclusive is weak. The platform preserves these forms separately and combines them only in a reviewable report. In particular, CVerify's predicted job family is retained as resume metadata rather than used as an automatic acceptance or rejection rule.

The fourth gap concerns **candidate agency and identity separation**. Enterprise recruitment functions frequently receive greater design attention than candidate access, privacy requests, and session recovery. This project creates an independent candidate account and authentication boundary, limits information exposure, and supports data export and deletion requests. Finally, there is a governance gap between broad responsible-AI principles and concrete software controls. The project translates principles into tenant-scoped authorization, hashed tokens, schema-validated AI output, model and prompt records, audit trails, recommendation overrides, and isolated code execution. It does not solve fairness or legal compliance completely, but it provides an architecture in which these responsibilities can be measured and managed.

<!-- PAGE BREAK -->

## 2.5 Relevance to Current Project

The literature directly influenced both functional and non-functional decisions in the AI Hiring Intelligence Platform. Research on structured interviews led to the use of job-related competencies, question types, difficulty levels, expected answers, rubrics, weights, and stable assessment versions [2], [3]. When an assessment is published, later changes do not silently alter the content associated with an existing interview. This supports comparability and makes an evaluation reproducible from the retained record.

Research on digital selection and applicant reactions influenced the candidate experience [9], [10]. Candidates receive a dedicated portal rather than a recruiter interface with hidden sections. They can use passwordless access, review available interviews, update appropriate profile data, manage their resume, and request data export or deletion. During an interview, progress is stored authoritatively in PostgreSQL, while drafts can be retained locally to reduce data loss after a connection problem. Consent and invitation expiry are explicit. These features support clarity and procedural fairness, although formal usability testing with representative candidates remains future work.

Transformer literature informed the choice of DistilBERT for CVerify [11], [12]. Compared with a larger general-purpose language model, a fine-tuned local classifier provides a focused output, repeatable label set, and reduced dependence on sending resume content to an external provider. The training procedure was strengthened by document-level splitting before chunk generation. Performance is reported using accuracy, weighted F1, and macro F1, because class imbalance can make accuracy alone misleading. The inference service also restricts file type and size and caps the number of processed chunks.

Bias and governance literature influenced the decision to keep AI output reviewable [4]-[7]. Evaluation records store provider, model, prompt version, confidence, strengths, weaknesses, and evidence. Recruiters can override a recommendation, but the changed decision and reason are recorded. Candidate APIs do not expose internal scores, hidden coding tests, rubrics, integrity events, or model credentials. AI provider calls are server-side, and malformed responses do not become trusted database records. These choices do not prove fairness, but they reduce opacity and make later auditing possible.

Security requirements also follow from the sensitivity of recruitment data. Organization membership and permission guards protect recruiter endpoints, while candidate sessions use separate cookies and token audiences. Invitation and reconnect secrets are stored as hashes. Untrusted candidate code is queued for a worker and executed in short-lived Docker containers with no network, restricted resources, dropped capabilities, and no unsafe host fallback. Thus, the literature is not included only as theoretical background; its recurring principles of structure, relevance, transparency, privacy, and oversight are represented in specific database, API, interface, and deployment controls.

<!-- PAGE BREAK -->

## 2.6 Summary

The literature survey shows that effective technology-supported recruitment must combine assessment quality with responsible implementation. Foundational selection research supports structured, job-related questions and consistent scoring because unstructured judgement can reduce comparability and validity [2], [3]. Digital-selection studies add that applicant perceptions, clarity, access, and procedural justice are important outcomes alongside organizational efficiency [9], [10]. These findings establish the need for both a recruiter workflow and a well-designed candidate experience.

Artificial intelligence and natural-language processing extend what a recruitment platform can do. Transformer models can classify and interpret text, and generative models can assist with role analysis, questions, follow-ups, and summaries [11], [12]. Nevertheless, the literature does not support treating fluent output or model accuracy as proof of fair and valid hiring. Bias can enter through historical data, proxy features, labels, system objectives, and deployment practices [4], [5]. Governance guidance therefore emphasizes documented purpose, quality measurement, transparency, privacy, human oversight, and continuous monitoring [6], [7], [13].

The review identified an opportunity for an integrated platform that links jobs, versioned assessments, candidate evidence, practical tasks, AI-assisted findings, and human decisions. It also identified the need to limit automation. In this project, resume classification organizes information but does not determine suitability; adaptive questioning is bounded; evaluations use validated structures and retained evidence; and recommendations can be reviewed and overridden. Separate identity boundaries, tenant-scoped access, secure token handling, audit records, and isolated code execution support the sensitive nature of the data and tasks.

The main research gap is not the absence of individual recruitment tools, but the absence of complete traceability and governance across their combined workflow. The AI Hiring Intelligence Platform addresses this gap through a practical architecture and a functioning software implementation. However, important evaluation work remains. A real organizational pilot should examine recruiter efficiency, candidate satisfaction, accessibility, inter-rater agreement, criterion-related validity, subgroup performance, adverse impact, and model drift. These measurements should use representative participants and documented protocols. The literature therefore provides both a justification for the project and a warning against overclaiming its results. The appropriate conclusion is that AI can improve organization and decision support when its role is bounded, its evidence is visible, and accountable people retain final authority.

<!-- PAGE BREAK -->

# References

[1] World Economic Forum, *The Future of Jobs Report 2025*. Geneva: World Economic Forum, 2025. [Online]. Available: https://www.weforum.org/publications/the-future-of-jobs-report-2025/

[2] M. A. Campion, D. K. Palmer, and J. E. Campion, "A review of structure in the selection interview," *Personnel Psychology*, vol. 50, no. 3, pp. 655-702, 1997. https://doi.org/10.1111/j.1744-6570.1997.tb00709.x

[3] F. L. Schmidt and J. E. Hunter, "The validity and utility of selection methods in personnel psychology: Practical and theoretical implications of 85 years of research findings," *Psychological Bulletin*, vol. 124, no. 2, pp. 262-274, 1998. https://doi.org/10.1037/0033-2909.124.2.262

[4] A. Köchling and M. C. Wehner, "Discriminated by an algorithm: A systematic review of discrimination and fairness by algorithmic decision-making in the context of HR recruitment and HR development," *Business Research*, vol. 13, pp. 795-848, 2020. https://doi.org/10.1007/s40685-020-00134-w

[5] M. Raghavan, S. Barocas, J. Kleinberg, and K. Levy, "Mitigating bias in algorithmic hiring: Evaluating claims and practices," in *Proceedings of the 2020 Conference on Fairness, Accountability, and Transparency*, 2020, pp. 469-481. https://doi.org/10.1145/3351095.3372828

[6] National Institute of Standards and Technology, *Artificial Intelligence Risk Management Framework (AI RMF 1.0)*, NIST AI 100-1, 2023. https://doi.org/10.6028/NIST.AI.100-1

[7] European Parliament and Council of the European Union, "Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence," *Official Journal of the European Union*, 2024. [Online]. Available: https://eur-lex.europa.eu/eli/reg/2024/1689/oj

[8] J. S. Black and P. van Esch, "AI-enabled recruiting: What is it and how should a manager use it?" *Business Horizons*, vol. 63, no. 2, pp. 215-226, 2020. https://doi.org/10.1016/j.bushor.2019.12.001

[9] S. A. Woods, S. Ahmed, I. Nikolaou, A. C. Costa, and N. R. Anderson, "Personnel selection in the digital age: A review of validity and applicant reactions, and future research challenges," *European Journal of Work and Organizational Psychology*, vol. 29, no. 1, pp. 64-77, 2020. https://doi.org/10.1080/1359432X.2019.1681401

[10] S. W. Gilliland, "The perceived fairness of selection systems: An organizational justice perspective," *Academy of Management Review*, vol. 18, no. 4, pp. 694-734, 1993. https://doi.org/10.2307/258595

[11] J. Devlin, M.-W. Chang, K. Lee, and K. Toutanova, "BERT: Pre-training of deep bidirectional transformers for language understanding," in *Proceedings of NAACL-HLT 2019*, pp. 4171-4186, 2019. https://doi.org/10.18653/v1/N19-1423

[12] V. Sanh, L. Debut, J. Chaumond, and T. Wolf, "DistilBERT, a distilled version of BERT: Smaller, faster, cheaper and lighter," arXiv:1910.01108, 2019. https://doi.org/10.48550/arXiv.1910.01108

[13] U.S. Equal Employment Opportunity Commission, "Select issues: Assessing adverse impact in software, algorithms, and artificial intelligence used in employment selection procedures under Title VII," 2023. [Online]. Available: https://www.eeoc.gov/select-issues-assessing-adverse-impact-software-algorithms-and-artificial-intelligence-used

[14] P. Tambe, P. Cappelli, and V. Yakubovich, "Artificial intelligence in human resources management: Challenges and a path forward," *California Management Review*, vol. 61, no. 4, pp. 15-42, 2019. https://doi.org/10.1177/0008125619867910
