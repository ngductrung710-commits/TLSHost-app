
-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_cleanedByMembershipId_fkey" FOREIGN KEY ("cleanedByMembershipId") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

