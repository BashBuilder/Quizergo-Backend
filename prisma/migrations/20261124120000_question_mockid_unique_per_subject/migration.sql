-- Question source ids (mockId) are only unique within a subject.
-- Keep the source id in mockId and scope its uniqueness by subject.
DROP INDEX "Question_mockId_key";

CREATE UNIQUE INDEX "Question_subject_mockId_key" ON "Question"("subject", "mockId");
