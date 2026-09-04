/**
 * English for the workspace.
 *
 * Keyed by the Vietnamese sentence itself. See src/lib/i18n.ts for why, and
 * `npm run check:i18n` for what keeps this file honest — it fails on a string
 * with no translation here, and on an entry here the app no longer says.
 *
 * The register is the same in both languages: plain, specific, and willing to
 * say what will actually happen. Where the Vietnamese explains a consequence —
 * that a sync will not delete anything, that a housekeeper cannot see prices —
 * the English explains the same consequence rather than shortening it into a
 * label. Someone reading this in English is running the same business.
 */

export const EN: Record<string, string> = {
  /* ---- Navigation and the shell ---- */
  "Tới nội dung chính": "Skip to main content",
  Chính: "Main",
  "Bảng điều khiển": "Dashboard",
  Lịch: "Calendar",
  "Trợ lý": "Assistant",
  "Buồng phòng": "Housekeeping",
  "Chỗ nghỉ": "Properties",
  "Kênh bán": "Channels",
  "Đội ngũ": "Team",
  "Cài đặt": "Settings",
  "Đăng xuất": "Sign out",
  "← Trước": "← Back",
  "← Về danh sách": "← Back to the list",
  "← Về lịch": "← Back to the calendar",

  /* ---- Signing in and joining ---- */
  "Chào mừng trở lại": "Welcome back",
  "Đăng nhập vào không gian quản lý của bạn.": "Sign in to your workspace.",
  "Đăng nhập": "Sign in",
  "Tạo tài khoản chủ nhà": "Create a host account",
  "Tạo tài khoản": "Create account",
  "Một tài khoản, một doanh nghiệp. Thêm cơ sở và mời người sau.":
    "One account, one business. Add properties and invite people afterwards.",
  "Đã có tài khoản? ": "Already have an account? ",
  "Chưa có tài khoản? ": "No account yet? ",
  "Email hoặc mật khẩu không đúng.": "That email or password is not right.",
  "Email này đã có tài khoản.": "That email already has an account.",
  "Email chưa đúng định dạng.": "That email address is not valid.",
  "Tài khoản này chưa đặt mật khẩu.": "This account has no password set.",
  "Cho tôi biết tên bạn.": "Tell us your name.",
  "Đặt tên cho cơ sở của bạn.": "Give your business a name.",
  "Ít nhất 12 ký tự. Dài quan trọng hơn phức tạp.":
    "At least 12 characters. Length matters more than complexity.",
  "Tham gia đội": "Join the team",
  "Đặt mật khẩu và tham gia": "Set a password and join",
  "Bạn đang ở trong": "You are joining",
  "Lời mời không dùng được": "This invitation does not work",
  "Lời mời hết hạn": "Invitation expired",
  "Lời mời này không dùng được nữa. Nhờ chủ nhà tạo lại giúp bạn.":
    "This invitation no longer works. Ask the host to create a new one.",
  "Link này đã được dùng, đã hết hạn, hoặc không đúng. Nhờ chủ nhà tạo lại một lời mời mới giúp bạn.":
    "This link has been used, has expired, or is not valid. Ask the host to send you a new invitation.",
  "Về trang đăng nhập": "Back to sign in",
  "Không gian chủ nhà": "Host workspace",

  /* ---- Dashboard ---- */
  "Hôm nay": "Today",
  "Ngày mai": "Tomorrow",
  "Khách đến": "Arrivals",
  "Khách đi": "Departures",
  "Đang lưu trú": "Staying",
  "Ở tiếp": "Staying on",
  "Không có ai nhận phòng.": "Nobody is checking in.",
  "Không có ai trả phòng.": "Nobody is checking out.",
  "Dự báo 14 ngày": "Next 14 days",
  "Lấp đầy": "Occupancy",
  "Đơn đặt": "Bookings",
  "Cột cao theo doanh thu, con số theo tỷ lệ lấp đầy. Hai thứ này tách nhau khi phòng rẻ kín mà phòng đắt trống — đó chính là tuần đáng để ý. Lượt đặt chưa nhập giá tính theo giá niêm yết của phòng; phòng chưa có giá không đóng góp gì.":
    "Bar height is revenue, the number is occupancy. The two come apart when the cheap rooms fill and the expensive ones sit empty — that is the week worth looking at. Bookings with no price entered are counted at the room's listed rate; rooms with no rate contribute nothing.",
  "Bảng này dựng từ danh sách phòng. Thêm cơ sở rồi quay lại.":
    "This board is built from your rooms. Add a property and come back.",
  "Thêm cơ sở đầu tiên và các phòng của nó. Lịch, buồng phòng và trang đặt phòng đều dựng lên từ đó.":
    "Add your first property and its rooms. The calendar, the housekeeping board and the booking page are all built from them.",
  khách: "guests",

  /* ---- Calendar ---- */
  "Bấm vào một ô trống để thêm đặt phòng, bấm vào một lượt đặt để sửa.":
    "Click an empty cell to add a booking, click a booking to edit it.",
  "Tạo đặt phòng": "New booking",
  "Sửa đặt phòng": "Edit booking",
  "Khóa đêm": "Block nights",
  "Khóa những đêm này": "Block these nights",
  "Bỏ khóa": "Unblock",
  "Đêm đang khóa trong khoảng này": "Nights blocked in this range",
  "Đêm cuối bị khóa là đêm trước ngày này.":
    "The last blocked night is the night before this date.",
  "Giữ phòng lại cho bảo trì hoặc cho chính bạn ở. Đêm bị khóa không nhận đặt phòng, và cũng không tính vào tỷ lệ lấp đầy.":
    "Hold a room for maintenance or for your own stay. Blocked nights take no bookings and do not count towards occupancy.",
  "Nếu những đêm này đã có người giữ, hệ thống sẽ từ chối và nói rõ ai đang giữ.":
    "If someone already holds these nights, this is refused and says who holds them.",
  "Từ ngày": "From",
  "Đến ngày": "To",
  "Lý do": "Reason",
  "Lý do khác": "Other reason",
  "Bảo trì": "Maintenance",
  "Chủ nhà ở": "Host stay",
  "Ghi chú": "Note",
  "Chọn ngày": "Pick a date",
  "Phòng": "Room",
  "Hủy đặt phòng này": "Cancel this booking",
  "Hủy đặt phòng": "Cancel booking",
  "Những đêm này sẽ trống trở lại ngay. Bản ghi vẫn được giữ, không bị xóa.":
    "These nights become free again immediately. The record is kept, not deleted.",
  "Đặt phòng này đã hủy, nên những đêm của nó đã trống trở lại. Bản ghi vẫn được giữ. Lưu lại bên dưới sẽ đưa nó về lịch — nếu những đêm đó chưa có người khác giữ.":
    "This booking is cancelled, so its nights are free again. The record is kept. Saving below puts it back on the calendar — if nobody else has taken those nights.",
  "Đặt phòng này do người khác tạo, bạn không sửa được.":
    "Someone else created this booking, so you cannot edit it.",
  "Đặt phòng này do người khác tạo. Bạn xem được nhưng chưa được cấp quyền sửa.":
    "Someone else created this booking. You can read it, but you have not been given permission to change it.",
  "Không tìm thấy đặt phòng này.": "That booking was not found.",
  "Không tìm thấy phòng này.": "That room was not found.",
  "Không tìm thấy chỗ nghỉ này.": "That property was not found.",
  "Vừa có người đặt những đêm này. Tải lại lịch và thử lại.":
    "Someone just booked these nights. Reload the calendar and try again.",
  "Ngày chưa hợp lệ.": "That date is not valid.",
  "Ngày kết thúc phải sau ngày bắt đầu.": "The end date must be after the start date.",
  "Ngày trả phòng phải sau ngày nhận phòng.":
    "The check-out date must be after the check-in date.",
  "Khoảng ngày không hợp lệ — ngày kết thúc phải sau ngày bắt đầu.":
    "That date range is not valid — the end date must be after the start date.",
  "Nhập tên khách.": "Enter the guest's name.",
  "Bạn không có quyền sửa đặt phòng.": "You do not have permission to edit bookings.",
  "Bạn không có quyền tạo đặt phòng.": "You do not have permission to create bookings.",
  "Bạn không có quyền khóa phòng.": "You do not have permission to block rooms.",
  "Lưu thay đổi": "Save changes",
  "Còn trống": "Free",
  "Đã đặt": "Booked",
  "Đã chặn": "Blocked",
  "Đã hủy": "Cancelled",

  /* ---- Housekeeping ---- */
  "Cần dọn": "To clean",
  "Đã kiểm tra": "Inspected",
  Sạch: "Clean",
  Bẩn: "Dirty",
  "Dọn phòng": "Cleaning",
  "Đánh dấu sạch": "Mark clean",
  "Đánh dấu tất cả đã sạch": "Mark everything clean",
  "Gắn cờ bảo trì": "Flag for maintenance",
  "Bỏ đánh dấu bảo trì": "Clear the maintenance flag",
  "phòng cần dọn": "rooms to clean",
  "không còn phòng nào cần dọn": "nothing left to clean",
  "phòng không còn tồn tại": "that room no longer exists",
  "Phòng tự chuyển sang cần dọn khi có khách trả phòng — không phải chờ ai bấm gì. Trạng thái đọc lại từ lịch mỗi lần mở trang, nên không bao giờ lệch.":
    "A room turns dirty by itself when a guest checks out — nobody has to press anything. The state is read back from the calendar each time this page opens, so it never drifts.",
  "Chỉ thấy phòng cần dọn. Không thấy giá phòng hay thông tin thanh toán của khách.":
    "You see the rooms to clean. You do not see room rates or guests' payment details.",

  /* ---- Properties ---- */
  "Thêm cơ sở": "Add a property",
  "Chưa có cơ sở nào": "No properties yet",
  "Chưa có phòng nào": "No rooms yet",
  "Tên bạn dùng để gọi chỗ nghỉ của mình. Đổi được sau.":
    "What you call this place yourself. You can change it later.",
  "(không bắt buộc)": "(optional)",
  "Phòng và giá": "Rooms and rates",
  "Giá mỗi đêm hiển thị trên trang đặt phòng. Phòng chưa có giá vẫn nhận được đặt, chỉ là khách không thấy con số nào.":
    "The nightly rate shown on the booking page. A room with no rate still takes bookings, the guest just sees no figure.",
  "bỏ giá": "clear the rate",
  "Thêm cơ sở đầu tiên và liệt kê các phòng bên trong. Lịch sẽ dựng lên từ đó.":
    "Add your first property and list the rooms inside it. The calendar is built from them.",

  /* ---- The public booking page ---- */
  "Trang đặt phòng của khách": "Guest booking page",
  "Một trang công khai để khách tự chọn ngày và đặt. Đặt phòng từ đây vào thẳng lịch này, khoá đêm trên mọi kênh, và không mất đồng hoa hồng nào.":
    "A public page where guests pick their own dates and book. Bookings from here land straight on this calendar, block those nights everywhere, and cost no commission.",
  "Đường dẫn": "Web address",
  "Đường dẫn cần ít nhất 3 ký tự.": "The address needs at least 3 characters.",
  "Đường dẫn này đã có người dùng. Thử thêm tên địa danh.":
    "That address is taken. Try adding the place name.",
  "Giới thiệu": "Introduction",
  "Vài dòng khách đọc trước khi đặt. Không bắt buộc.":
    "A few lines a guest reads before booking. Optional.",
  "Trang khách đang mở": "Page is live",
  "Mở trang cho khách": "Open the page to guests",
  "Mở trang khách thấy →": "Open the page guests see →",
  "Tắt đi thì trang biến mất khỏi internet nhưng đường dẫn vẫn giữ, bật lại lúc nào cũng được.":
    "Turning it off takes the page off the internet but keeps the address, so you can turn it back on whenever.",
  "Trang đã mở. Chia sẻ link bên dưới cho khách.":
    "The page is live. Share the link below with guests.",
  "Đã đóng trang. Link giữ nguyên, mở lại lúc nào cũng được.":
    "The page is closed. The link is unchanged, so you can reopen it whenever.",
  "Chỉ chủ nhà mới đổi được trang này.": "Only the host can change this page.",
  "Chưa có link. Nhờ chủ nhà tạo.": "No link yet. Ask the host to create one.",

  /* ---- Channels ---- */
  "Kết nối kênh": "Connect a channel",
  "Kết nối kênh mới": "Connect another channel",
  "Chưa kết nối kênh nào": "No channels connected",
  "Nối lịch của Airbnb, Booking.com hay Agoda vào đây, rồi dán link xuất của bạn ngược lại bên đó. Một đêm bán ở đâu sẽ khoá ở mọi nơi.":
    "Bring in the calendars from Airbnb, Booking.com or Agoda, then paste your export link back into each of them. A night sold anywhere is blocked everywhere.",
  Kênh: "Channel",
  "Kênh khác": "Other channel",
  "Nơi khác": "Elsewhere",
  "Link iCal của kênh": "The channel's iCal link",
  "Link iCal chưa đúng định dạng.": "That iCal link is not valid.",
  "Link phải bắt đầu bằng http:// hoặc https://":
    "The link must start with http:// or https://",
  "Link này trỏ vào mạng nội bộ, không dùng được.":
    "That link points inside a private network, so it cannot be used.",
  "Trong Airbnb: Lịch → Khả dụng → Đồng bộ lịch → Xuất lịch. Link này là chìa khoá vào lịch của bạn, đừng chia sẻ ra ngoài.":
    "In Airbnb: Calendar → Availability → Sync calendars → Export calendar. That link is a key to your calendar — do not share it.",
  "Phòng này đã kết nối kênh đó rồi.": "That room is already connected to that channel.",
  "Chỉ chủ nhà mới kết nối được kênh.": "Only the host can connect channels.",
  "Đã kết nối. Bấm Đồng bộ ngay để kéo lịch về.":
    "Connected. Press Sync now to pull the calendar in.",
  "Đồng bộ ngay": "Sync now",
  "đồng bộ tự động": "syncs automatically",
  "Đang chạy": "Running",
  "Chưa đồng bộ lần nào": "Never synced",
  "vừa xong": "just now",
  Ngắt: "Disconnect",
  "Lần đồng bộ gần đây": "Recent syncs",
  "Khi lịch trông sai, đây là chỗ trả lời đồng bộ đã làm gì.":
    "When the calendar looks wrong, this is where you find out what the sync did.",
  "Đã giữ lại": "Held back",
  "Lần đồng bộ gần nhất thấy nhiều khoảng biến mất cùng lúc, nên không xoá gì cả. Kiểm tra lại trên trang của kênh: nếu đúng là khách đã hủy, bấm Đồng bộ ngay lần nữa để áp dụng.":
    "The last sync saw a large number of dates disappear at once, so it deleted nothing. Check on the channel's own site: if those guests really did cancel, press Sync now again to apply it.",
  "Link xuất lịch của bạn": "Your export link",
  "Tạo link xuất": "Create an export link",
  "Đổi khoá": "Rotate the key",
  "Mỗi phòng nối một link cho mỗi kênh.": "One link per room, for each channel.",
  "Dán link của một phòng vào phần nhập lịch của từng kênh. Link chỉ nói đêm nào đã kín — không có tên khách, không có giá.":
    "Paste a room's link into each channel's calendar import. The link says only which nights are taken — no guest names, no prices.",
  "Lỗi": "Error",

  /* ---- Team ---- */
  "Mời người mới": "Invite someone",
  "Tạo lời mời": "Create invitation",
  "Lời mời đã tạo": "Invitation created",
  "Lời mời": "Invitation",
  "Gửi link này cho họ. Link dùng được một lần, hết hạn sau 14 ngày.":
    "Send them this link. It works once and expires after 14 days.",
  "Tạo lời mời rồi gửi link cho họ. Chưa có gửi email tự động, nên bạn tự gửi qua Zalo hoặc tin nhắn.":
    "Create an invitation and send them the link. There is no automatic email yet, so send it over Zalo or a message yourself.",
  "Nhập tên người bạn muốn mời.": "Enter the name of the person you are inviting.",
  "Người này đã ở trong đội của bạn.": "That person is already on your team.",
  "Chỉ chủ nhà mới mời được người khác.": "Only the host can invite people.",
  "Vai trò": "Role",
  "Chủ nhà": "Host",
  "Cộng tác viên": "Collaborator",
  "Chỗ nghỉ được giao": "Assigned properties",
  "Tất cả chỗ nghỉ": "All properties",
  "Không chọn gì nghĩa là tất cả chỗ nghỉ.": "Selecting nothing means every property.",
  "Xem và quản lý đặt phòng ở những chỗ nghỉ bạn giao.":
    "Sees and manages bookings at the properties you assign.",
  "Sửa được đặt phòng của người khác": "Can edit other people's bookings",
  "Được sửa đặt phòng do người khác tạo":
    "May change bookings that someone else created",
  "Bỏ trống thì họ chỉ sửa được những gì chính họ nhập.":
    "Left off, they can only change what they entered themselves.",
  "Gỡ khỏi đội": "Remove from the team",
  "Gỡ một người có hiệu lực ngay ở request kế tiếp của họ — không phải chờ phiên đăng nhập hết hạn.":
    "Removing someone takes effect on their very next request — there is no waiting for a session to expire.",
  "Chờ bạn duyệt": "Waiting for you",
  "Đang chờ": "Pending",
  "Hết hạn": "Expired",
  "Hoạt động": "Active",
  "— giá phòng và trang đặt phòng của khách":
    "— room rates and the guest booking page",
  "— mời người, giao chỗ nghỉ, gỡ quyền":
    "— inviting people, assigning properties, removing access",
  "— đồng bộ iCal và link xuất lịch": "— iCal sync and export links",
  "của chính bạn": "your own",

  /* ---- Assistant ---- */
  "Bạn cần làm gì?": "What do you need?",
  "Mô tả việc bạn cần làm.": "Describe what you need done.",
  "Mô tả việc bạn cần bằng lời thường ngày. Trợ lý soạn sẵn thay đổi, bạn đọc rồi duyệt — không có gì được ghi vào lịch trước khi bạn gật đầu.":
    "Describe what you need in ordinary words. The assistant drafts the change, you read it and approve — nothing reaches the calendar before you say so.",
  "Nhờ trợ lý soạn": "Ask the assistant",
  "Đề xuất": "Proposal",
  Duyệt: "Approve",
  "Từ chối": "Decline",
  "Đã duyệt": "Approved",
  "Đã từ chối": "Declined",
  "Trợ lý chưa được bật": "The assistant is not switched on",
  "rồi khởi động lại. Mọi thứ khác trên trang này vẫn dùng được — đề xuất đã có vẫn duyệt được bình thường.":
    "and restart. Everything else here still works — proposals you already have can still be approved.",
  "Bạn không có quyền dùng trợ lý.": "You do not have permission to use the assistant.",
  "Không đọc được nội dung đề xuất.": "That proposal could not be read.",
  "Chuyển khoảng ngày": "Move the dates",
  "Vượt phòng": "Over capacity",
  "Chị Lan đặt Sky Loft 20 đến 23 tháng 11, hai người, số 0905123456":
    "Lan is booking Sky Loft from 20 to 23 November, two people, phone 0905123456",
  "Khóa Garden Suite từ 5 đến 8 tháng 12 để sơn lại phòng tắm":
    "Block Garden Suite from 5 to 8 December to repaint the bathroom",
  "Đặt giá Ocean View Studio thành 1.600.000 một đêm":
    "Set Ocean View Studio to 1,600,000 a night",

  /* ---- Settings: account ---- */
  "Tài khoản": "Account",
  "Tên của bạn": "Your name",
  Tên: "Name",
  "Tên không được để trống.": "A name cannot be empty.",
  "Tên này hiện bên cạnh mỗi đặt phòng và mỗi lần dọn phòng bạn ghi nhận.":
    "This name appears beside every booking and every clean you record.",
  "Mật khẩu": "Password",
  "Mật khẩu hiện tại": "Current password",
  "Mật khẩu mới": "New password",
  "Mật khẩu hiện tại không đúng.": "That current password is not right.",
  "Nhập mật khẩu hiện tại.": "Enter your current password.",
  "Đổi mật khẩu": "Change password",
  "Ít nhất 12 ký tự. Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác — phiên bạn đang dùng vẫn giữ nguyên.":
    "At least 12 characters. Changing it signs out every other device — the session you are using stays.",
  "Đã đổi mật khẩu. Mọi phiên đăng nhập khác đã bị đăng xuất; phiên này vẫn giữ.":
    "Password changed. Every other session has been signed out; this one is still yours.",

  /* ---- Settings: business ---- */
  "Doanh nghiệp": "Business",
  "Tên doanh nghiệp": "Business name",
  "Tên doanh nghiệp không được để trống.": "The business name cannot be empty.",
  "Múi giờ": "Time zone",
  "Quyết định “hôm nay” là ngày nào trên lịch và bảng buồng phòng. Đổi múi giờ có thể làm một phòng chuyển sang cần dọn sớm hoặc muộn hơn một ngày.":
    "Decides which day counts as today on the calendar and the housekeeping board. Changing it can move a room into needing a clean a day earlier or later.",
  ". Chỉ chủ nhà đổi được tên và múi giờ.":
    ". Only the host can change the name and time zone.",
  ". Đổi tiền tệ chưa làm được từ đây: mọi giá đã nhập đều là số nguyên theo đơn vị hiện tại, nên đổi mà không quy đổi lại sẽ biến 1.200.000 đồng thành 1.200.000 đô. Khi nào cần, việc đó phải kèm một bước quy đổi thật.":
    ". Changing currency cannot be done from here: every rate already entered is a whole number in the current unit, so switching without converting would turn 1,200,000 dong into 1,200,000 dollars. When it is needed, it has to come with a real conversion step.",
  "Chỉ chủ nhà mới đổi được cài đặt cơ sở.":
    "Only the host can change the business settings.",

  /* ---- Settings: appearance and the booking page's look ---- */
  "Giao diện": "Appearance",
  Sáng: "Light",
  Tối: "Dark",
  "Theo hệ thống": "Match the system",
  "Sáng, tối, hoặc theo cài đặt của máy. Lưu riêng cho thiết bị này — người khác trong đội không bị đổi theo.":
    "Light, dark, or whatever the device is set to. Saved for this device only — nobody else on the team is changed.",
  "Giao diện trang đặt phòng": "Booking page look",
  "Trang khách nhìn thấy khi bạn chia sẻ link. Áp dụng cho tất cả chỗ nghỉ.":
    "The page guests see when you share a link. Applies to every property.",
  "Phong cách": "Style",
  "Áp dụng cho trang đặt phòng của mọi chỗ nghỉ. Bốn phong cách này đều đã được kiểm tra độ tương phản, nên khách luôn đọc được.":
    "Applies to the booking page of every property. All four styles have been contrast-checked, so a guest can always read them.",
  "Chọn màu": "Pick a colour",
  "Dùng màu mặc định": "Use the style's colour",
  "Dùng cho nút và điểm nhấn. Để trống thì lấy màu của phong cách. Màu quá nhạt sẽ bị từ chối — nút phải đọc được.":
    "Used for buttons and highlights. Left empty, the style's own colour is used. A colour too pale to read on is refused — the button has to be legible.",
  "Tải lên": "Upload",
  "Gỡ logo": "Remove the logo",
  "Chưa có": "None",
  "Chưa chọn tệp nào.": "No file chosen.",
  "PNG, JPEG hoặc WebP, tối đa 2 MB. Hiện ở đầu trang đặt phòng của khách. Không nhận SVG — định dạng đó chứa được mã, và trang này phục vụ người lạ.":
    "PNG, JPEG or WebP, up to 2 MB. Shown at the top of the guest booking page. SVG is not accepted — that format can carry code, and this page serves strangers.",
  "Lưu giao diện": "Save the look",
  "Đã lưu giao diện trang đặt phòng.": "Booking page look saved.",
  "Đã tải logo lên.": "Logo uploaded.",
  "Chỉ chủ nhà mới đổi được giao diện.": "Only the host can change the look.",
  "Chỉ chủ nhà mới đổi được logo.": "Only the host can change the logo.",

  /* ---- Settings: payments ---- */
  "Thanh toán": "Payments",
  "Kết nối tài khoản Stripe hoặc PayPal": "Connect your own Stripe or PayPal account",
  ". Khách trả thẳng vào đó — TLSHost không giữ tiền và không lấy phần trăm nào. Phí của cổng thanh toán là do họ thu, không phải chúng tôi.":
    ". Guests pay straight into it — TLSHost never holds the money and takes no percentage. The processor's fees are theirs, not ours.",
  "Chưa kết nối": "Not connected",
  "Đang kiểm tra khoá…": "Checking the key…",
  "Chế độ thật": "Live mode",
  "Bỏ trống để chạy sandbox. Khách sẽ không bị trừ tiền thật.":
    "Leave it off to run in sandbox. No guest is charged real money.",
  " (chế độ thử nghiệm)": " (test mode)",
  " · chế độ thử nghiệm": " · test mode",
  "pk_live_… hoặc pk_test_…": "pk_live_… or pk_test_…",
  "sk_live_… hoặc sk_test_… — lấy ở Developers → API keys.":
    "sk_live_… or sk_test_… — from Developers → API keys.",
  "Lấy ở Apps & Credentials trong tài khoản Business.":
    "From Apps & Credentials in your Business account.",
  "Cùng chỗ với Client ID, bấm Show để xem.":
    "Same place as the Client ID, press Show to reveal it.",
  "Thiếu khoá công khai / client ID.": "The publishable key or client ID is missing.",
  "Thiếu khoá bí mật.": "The secret key is missing.",
  "Đây là khoá thử nghiệm nhưng bạn đã bật chế độ thật.":
    "That is a test key, but you have switched live mode on.",
  "Đây là khoá thật nhưng bạn đang để chế độ thử nghiệm.":
    "That is a live key, but you are still in test mode.",
  "Chỉ chủ nhà mới kết nối được cổng thanh toán.":
    "Only the host can connect a payment provider.",
  "Máy chủ chưa có SECRET_KEY nên chưa lưu khoá thanh toán an toàn được. Xem README.":
    "The server has no SECRET_KEY, so payment keys cannot be stored safely yet. See the README.",
  "Máy chủ chưa đặt SECRET_KEY nên chưa lưu được khoá thanh toán một cách an toàn. Xem README để tạo.":
    "The server has no SECRET_KEY set, so payment keys cannot be stored safely. See the README to create one.",
  "Chưa kết nối cổng nào thì khách vẫn đặt phòng bình thường và trả khi nhận phòng — đó cũng là cách phần lớn chỗ nghỉ ở Việt Nam đang làm.":
    "With no provider connected, guests book exactly as before and pay on arrival — which is how most places in Vietnam do it anyway.",

  /* ---- Settings: plan ---- */
  "Gói dịch vụ": "Plan",
  "Thuê bao cố định, không phí trên mỗi lượt đặt ở bất kỳ gói nào.":
    "A flat subscription. No per-booking fee on any plan.",
  "Đang dùng": "Current",
  "Đang dùng:": "Current plan:",
  "Miễn phí": "Free",
  "Đội ngũ & phân quyền": "Team and permissions",

  /* ---- Settings: notifications ---- */
  "Thông báo đặt phòng": "Booking notifications",
  "Báo trên thiết bị này khi có khách đặt trực tiếp. Thông báo chỉ nói tên khách và phòng — không có số điện thoại, không có số tiền, vì nó hiện trên màn hình khoá nơi người bên cạnh cũng đọc được.":
    "Tells this device when a guest books directly. The notification says only the guest's name and the room — no phone number, no amount, because it appears on a lock screen where the person beside you can read it too.",
  "Bật thông báo trên thiết bị này": "Turn notifications on for this device",
  "Đang bật trên thiết bị này": "On for this device",
  "Đang bật…": "Turning on…",
  Tắt: "Turn off",
  "Gửi thử một thông báo": "Send a test notification",
  "Thông báo đang hoạt động. Đặt phòng mới sẽ hiện như thế này.":
    "Notifications are working. A new booking will look like this.",
  "Đặt phòng mới": "New booking",
  "Trình duyệt này không hỗ trợ thông báo đẩy.":
    "This browser does not support push notifications.",
  "Trình duyệt này không hỗ trợ.": "This browser does not support it.",
  "Trên iPhone cần thêm TLSHost vào Màn hình chính trước, rồi mở từ đó.":
    "On iPhone, add TLSHost to the Home Screen first, then open it from there.",
  "Thiết bị này đã chặn thông báo từ TLSHost. Mở cài đặt của trình duyệt, cho phép lại rồi tải lại trang — nút ở đây không mở lại được, đó là chủ ý của trình duyệt.":
    "This device has blocked notifications from TLSHost. Allow them again in the browser's own settings and reload — a button here cannot reopen that prompt, which is the browser's intention.",
  "Chưa cấu hình khoá VAPID trên máy chủ, nên thông báo chưa dùng được. Xem README để tạo và thêm vào .env.":
    "The server has no VAPID keys configured, so notifications are not available yet. See the README to generate them and add them to .env.",
  "Chưa cài được service worker.": "The service worker could not be installed.",
  "Không đăng ký được thông báo.": "Notifications could not be registered.",

  /* ---- Shared verbs and states ---- */
  Lưu: "Save",
  "Đang lưu…": "Saving…",
  "Đã lưu.": "Saved.",
  "Hủy": "Cancel",
  "Đang xử lý…": "Working…",
  "Đang tạo…": "Creating…",
  "Đang soạn…": "Drafting…",
  "Đang kiểm tra…": "Checking…",
  "Thông tin chưa hợp lệ.": "Something in that is not valid.",
  "Tối đa": "Maximum",

  /* ---- Sentences with something in the middle of them ----
     The placeholder stays inside the key so each language decides where in
     the sentence it goes. See fill() in src/lib/i18n.ts. */
  "{n} phút trước": "{n} minutes ago",
  "{n} giờ trước": "{n} hours ago",
  "{n} ngày trước": "{n} days ago",
  "Đồng bộ {khi}": "Synced {khi}",
  " · {n} giữ lại": " · {n} held back",
  " · {n} lời mời đang chờ": " · {n} invitations waiting",
  " · đón {ten}": " · {ten} arriving",
  " · duyệt {ngay}": " · approved {ngay}",
  " · đến {ngay}": " · until {ngay}",
  "/ tháng": "/ month",
  "/ vĩnh viễn": "/ forever",
  "Kết nối {ten}": "Connect {ten}",
  "Đã kết nối {ten}{chedo}.": "{ten} connected{chedo}.",
  "Giá thấp nhất đang đặt: {gia}.": "Lowest rate set: {gia}.",
  " và {n} mục nữa": " and {n} more",
  "Những đêm này đã có người giữ: {ai}{them}.":
    "Someone already holds these nights: {ai}{them}.",
  "{daDat} phòng đã đặt, {daChan} phòng đã chặn, {conTrong} phòng còn trống trên tổng {tong}":
    "{daDat} rooms booked, {daChan} blocked, {conTrong} free out of {tong}",

  /* The assistant's proposal preview — what a host reads before approving. */
  "Phòng: {ten}": "Room: {ten}",
  "Ngày: {tu} → {den}": "Dates: {tu} → {den}",
  "Ngày mới: {tu} → {den}": "New dates: {tu} → {den}",
  "Khách: {ten}{sdt}": "Guest: {ten}{sdt}",
  "Số khách: {n} · Nguồn: {nguon}": "Guests: {n} · Source: {nguon}",
  "Ghi chú: {noi}": "Note: {noi}",
  "Khóa: {tu} → {den}": "Blocked: {tu} → {den}",
  "Lý do: {ly}": "Reason: {ly}",
  "Hủy đặt phòng: {ma}": "Cancel booking: {ma}",
  "Đặt phòng: {ma}": "Booking: {ma}",
  "Chuyển sang: {ten}": "Move to: {ten}",
  "Giá mỗi đêm: {gia}": "Rate per night: {gia}",

  /* ---- Counts and fragments that sit between two values on a line ---- */
  "{n} phòng": "{n} rooms",
  "{n} đêm": "{n} nights",
  "{n} phòng cần dọn →": "{n} rooms to clean →",
  "lấp đầy {n}%": "{n}% full",
  "Trung bình": "Average",
  "{choNghi} chỗ nghỉ · {phong} phòng": "{choNghi} properties · {phong} rooms",
  "{n} người đang hoạt động": "{n} people active",
  "Tạo bởi {ai}": "Created by {ai}",
  "Dọn {ngay}": "Cleaned {ngay}",
  "{n} kết nối · đồng bộ hai chiều qua iCal":
    "{n} connected · two-way sync over iCal",
  "Có {n} kênh đang giữ lại việc xoá": "{n} channels are holding deletions back",
  "khoảng đang giữ": "dates held",
  "Giữ {n} việc xoá": "{n} deletions held",
  "{thay} thấy · {ap} áp dụng · {go} gỡ":
    "{thay} seen · {ap} applied · {go} removed",
  "Đơn vị tiền tệ đang là": "The currency is",
  "Ngắt kết nối {ten}": "Disconnect {ten}",
  "Đã kết nối": "Connected",
  "Khoá được mã hoá trước khi lưu và không bao giờ hiện lại trên màn hình này.":
    "The key is encrypted before it is stored and is never shown on this screen again.",
  "Gói {ten} đã hết hạn. Giới hạn tạm quay về gói Khởi đầu — không có gì bị xoá, chỗ nghỉ và đặt phòng vẫn nguyên, chỉ là chưa thêm mới được cho tới khi gia hạn.":
    "The {ten} plan has expired. Limits fall back to Free for now — nothing has been deleted, your properties and bookings are untouched, you just cannot add more until it is renewed.",
  "{n} phòng chưa có giá. Khách vẫn đặt được, nhưng sẽ không thấy giá nào cả — nên đặt giá trước khi chia sẻ link.":
    "{n} rooms have no rate. Guests can still book them, but will see no price at all — set the rates before you share the link.",
  "Link xuất lịch cho từng phòng nằm ở": "Each room's export link is under",
  "Màu thương hiệu": "Brand colour",
  "Ví dụ:": "For example:",
  "Cần một khóa API của Anthropic. Thêm": "This needs an Anthropic API key. Add",
  "vào tệp": "to",
  "Hết hạn lúc": "Expires",
  "Chào {ten}. Đặt mật khẩu để bắt đầu — tài khoản của bạn là":
    "Hello {ten}. Set a password to get started — your account is",

  /* ---- The switcher itself ---- */
  "Ngôn ngữ": "Language",
  "Ngôn ngữ của không gian làm việc, riêng cho thiết bị này. Trang đặt phòng khách nhìn thấy không đổi theo — đó là lựa chọn của chỗ nghỉ, không phải của người đang đăng nhập.":
    "The language of this workspace, for this device only. The booking page guests see does not follow it — that is the property's choice, not the choice of whoever is signed in.",

  /* ---- Labels that live in lib and get read on a workspace screen ---- */
  "Trực tiếp": "Direct",
  "Đã bán trên kênh khác": "Sold on another channel",
  "Đã khóa": "Blocked",
  "Những đêm này đã có người giữ": "Someone already holds these nights",
  "Chuyển khách": "Turnover",
  "Trả phòng": "Check-out",
  "Khách ở tiếp": "Staying on",
  "Trống": "Empty",
  "Dời đặt phòng": "Move booking",
  "Đặt giá phòng": "Set room rate",
  "Không có gì để làm": "Nothing to do",
  "Cổ điển": "Classic",
  "Tối giản": "Minimal",
  "Ấm áp": "Warm",
  "Nổi bật": "Bold",
  "Không đọc được mã màu này.": "That colour code could not be read.",
  "Màu phải ở dạng #rrggbb, ví dụ #a05436.":
    "The colour must be in #rrggbb form, for example #a05436.",
  "Đồng bộ kênh OTA có từ gói Kênh bán trở lên.":
    "OTA channel sync is on the Channels plan and above.",
  "Trợ lý AI có ở gói Chuyên nghiệp.": "The AI assistant is on the Professional plan.",
  "Mời cộng tác viên và phân quyền có ở gói Chuyên nghiệp.":
    "Inviting collaborators and setting permissions is on the Professional plan.",
  "Ngày phải theo dạng YYYY-MM-DD": "Dates must be in YYYY-MM-DD form",

  /* ---- The calendar and the booking form ---- */
  "Bảng lịch cần ít nhất một phòng để có gì mà hiển thị. Thêm cơ sở đầu tiên rồi quay lại đây.":
    "The calendar needs at least one room before it has anything to show. Add your first property and come back.",
  "Danh sách đặt phòng trong khoảng đang xem":
    "Bookings in the range currently shown",
  "Nhận phòng": "Check-in",
  "Tên khách": "Guest name",
  "Điện thoại": "Phone",
  "Số khách": "Guests",
  "Nguồn": "Source",
  "Đêm cuối là đêm trước ngày này — phòng trống lại từ sáng hôm đó.":
    "The last night is the night before this date — the room is free again that morning.",

  /* ---- Taking a booking over the phone ---- */
  "Nhận đặt phòng": "Take a booking",
  "Khách hỏi ngày nào, gõ ngày đó. Màn hình này trả lời còn phòng nào và bao nhiêu tiền cho cả kỳ — không phải dò trên lịch trong lúc khách đang chờ máy.":
    "Type the dates the guest is asking about. This screen answers which rooms are free and what the whole stay costs — rather than hunting across the calendar while they wait on the line.",
  "Tìm phòng trống": "Find free rooms",
  "Ngày trả phòng phải sau ngày nhận phòng, và tối đa {n} đêm một lần.":
    "The check-out date must be after the check-in date, and at most {n} nights at a time.",
  "{trong} / {tong} phòng còn trống": "{trong} of {tong} rooms free",
  "{tu} – {den}, {dem} đêm, {khach} khách":
    "{tu} – {den}, {dem} nights, {khach} guests",
  "Không có phòng nào nhận được {n} khách. Sức chứa đặt ở trang chỗ nghỉ.":
    "No room takes {n} guests. Capacity is set on the property page.",
  "Kín hết những đêm này. Thử lệch một đêm, hoặc mở lịch xem ai đang giữ.":
    "Everything is taken on these nights. Try shifting by a night, or open the calendar to see who holds them.",
  "Mở lịch": "Open the calendar",
  "tối đa {n} khách": "up to {n} guests",
  "chưa đặt giá": "no rate set",
  "{gia} × {dem} đêm": "{gia} × {dem} nights",
  "Đặt phòng này": "Book this room",
  "Còn trống ở đây nghĩa là còn trống lúc bạn mở trang. Hai người cùng nhận một phòng thì người lưu sau bị từ chối, và được nói rõ ai đang giữ — chỗ đó do cơ sở dữ liệu quyết, không phải màn hình này.":
    "Free here means free when this page loaded. If two people take the same room, whoever saves second is refused and told who holds it — that decision lives in the database, not on this screen.",

  /* ---- The rail, and the dashboard's activity panel ---- */
  "Thu gọn điều hướng": "Collapse the navigation",
  "Mở rộng điều hướng": "Expand the navigation",
  "Hoạt động đặt phòng": "Booking activity",
  "Không có khách đến hay khách lưu trú trong ngày này.":
    "No arrivals and nobody staying on this day.",

  "Sau →": "Next →",

  /* ---- Settings tabs ---- */
  Chung: "General",
  "Người dùng / Nhóm": "Users / Team",

  "Mở trợ lý AI": "Open the AI assistant",

  /* ---- The add-property wizard, and the property types ---- */
  "Cơ sở mới": "New property",
  "Các bước": "Steps",
  "Đóng": "Close",
  "Tiếp tục": "Continue",
  "Quay lại": "Back",
  "Tạo cơ sở": "Create property",

  /* Step 1 — about the property */
  "Thông tin cơ sở": "About the property",
  "Tên cơ sở": "Property name",
  "Homestay Vườn Hội An": "Hoi An Garden Homestay",
  "Loại hình": "Kind of place",
  "Tiền tệ": "Currency",
  "Tìm địa chỉ cơ sở": "Find the property address",
  "Nhập địa chỉ, tên đường hoặc thành phố": "Enter an address, street or city",
  "Dán cả địa chỉ rồi nhấn Enter — các ô bên dưới tự điền theo dấu phẩy.":
    "Paste the whole address and press Enter — the fields below fill themselves from the commas.",
  "Số nhà và tên đường": "Street address",
  "12 Trần Phú": "12 Tran Phu",
  "Tòa nhà, tầng, căn (không bắt buộc)": "Building, floor, unit (optional)",
  "Tên tòa nhà, tầng, căn": "Building name, floor, unit",
  "Thành phố": "City",
  "Tỉnh / thành / khu vực": "Province / state / region",
  "Mã bưu chính": "Postal code",
  "Quốc gia / khu vực": "Country / region",
  "Đặt tên cho cơ sở.": "Give the property a name.",
  "Điền số nhà và tên đường.": "Fill in the street address.",
  "Điền thành phố.": "Fill in the city.",
  "Chưa chọn được tiền tệ.": "That currency is not one we support.",
  "Chỉ chủ nhà mới thêm được cơ sở.": "Only an owner can add a property.",

  /* Step 2 — the first room */
  "Phòng đầu tiên và giá": "First room and rate",
  "Tên loại phòng": "Room type name",
  "Phòng Tiêu chuẩn": "Standard Room",
  "Mô tả phòng": "Room description",
  "Mô tả phòng, giường, tầm nhìn, sự riêng tư và phòng tắm.":
    "Describe the room, the beds, the view, the privacy and the bathroom.",
  "Số lượng phòng": "How many rooms",
  "Giá mỗi đêm": "Rate per night",
  "Tối đa người lớn": "Maximum adults",
  "Tối đa trẻ em": "Maximum children",
  "Đặt tên cho loại phòng.": "Give the room type a name.",
  "Cho thuê nguyên căn thì để 1 — cả căn là một phòng.":
    "Renting the whole place? Leave it at 1 — the whole place is one room.",
  "Tạo {n} phòng, đánh số từ 1 đến {n}. Đổi tên từng phòng được sau.":
    "Creates {n} rooms, numbered 1 to {n}. You can rename each one later.",
  "Sức chứa mỗi phòng: {n} khách. Để trống giá cũng được — phòng vẫn nhận đặt, chỉ là khách không thấy con số nào.":
    "Each room sleeps {n}. Leaving the rate empty is fine — the room still takes bookings, the guest just sees no figure.",

  /* Step 3 — amenities */
  "Tiện nghi": "Amenities",
  "Tiện nghi cơ sở": "Property amenities",
  "Tiện nghi phòng đầu tiên": "First room's amenities",
  "Đã chọn {n}": "{n} selected",
  "Bỏ chọn": "Clear",
  "Bỏ {ten}": "Remove {ten}",
  "Tìm tiện nghi": "Search amenities",
  "Không có tiện nghi nào khớp.": "Nothing matches that.",

  /* Step 4 — what a guest reads */
  "Mô tả và chính sách": "Description and policies",
  "Mô tả listing": "Listing description",
  "Mô tả không gian, khu vực xung quanh, trải nghiệm của khách và điểm đặc biệt của chỗ nghỉ.":
    "Describe the space, the neighbourhood, what a stay is like and what makes the place itself.",
  "Hiện trên trang đặt phòng, ngay dưới tên cơ sở. Không bắt buộc.":
    "Shown on the booking page, right under the property name. Optional.",
  "Nội quy lưu trú": "House rules",
  "Mỗi dòng một điều. Khách đọc đúng như bạn viết.":
    "One rule per line. Guests read them exactly as you write them.",

  /* Step 5 — review */
  "Xem lại và tạo": "Review and create",
  "Phòng đầu tiên": "First room",
  "Sức chứa mỗi phòng": "Sleeps per room",
  "Tiện nghi cơ sở / phòng": "Amenities, property / room",
  "Nội quy": "House rules",
  "{gia} / đêm": "{gia} / night",
  "{nl} người lớn · {te} trẻ em": "{nl} adults · {te} children",
  "Sửa thông tin cơ sở": "Edit the property details",
  "Sửa phòng đầu tiên": "Edit the first room",
  "Sửa tiện nghi": "Edit the amenities",
  "Sửa mô tả và chính sách": "Edit the description and policies",
  "Tạo xong, cơ sở hiện ngay trên lịch. Trang đặt phòng cho khách vẫn tắt cho tới khi bạn bật.":
    "Once created it appears on the calendar straight away. The guest booking page stays off until you turn it on.",

  "Khách sạn": "Hotel",
  "Khách sạn boutique": "Boutique hotel",
  /* Homestay, Resort and Hostel are the same word in both languages, so
     they have no entry here — t() returns the key unchanged. */
  "Biệt thự": "Villa",
  "Căn hộ": "Apartment",
  "Nhà nghỉ": "Guesthouse",

  /* Worded around the plural rather than into it. Vietnamese does not inflect
     for number, so the key reads correctly at any {n}; English does, and
     "allows 1 properties" is what a literal translation produces. */
  "Gói hiện tại cho tối đa {n} cơ sở. Nâng cấp để thêm cơ sở mới.":
    "This plan's limit is {n}. Upgrade to add another property.",

  /* ---- What each plan lists, word for word with the pricing page ---- */
  "Một chỗ nghỉ": "One property",
  "Lịch đặt phòng và kho phòng": "Booking calendar and inventory",
  "Trang đặt phòng trực tiếp của bạn": "Your direct booking page",
  "Không hoa hồng đặt phòng": "No booking commission",
  "Mọi thứ trong gói Miễn phí": "Everything in Free",
  "Đồng bộ kênh OTA hai chiều": "Two-way OTA channel sync",
  "Airbnb, Booking.com, Agoda và nhiều kênh khác":
    "Airbnb, Booking.com, Agoda and more channels",
  "Tự động đồng bộ tình trạng phòng từng giờ":
    "Availability synced automatically, hourly",
  "Nhiều chỗ nghỉ": "Multiple properties",
  "Mọi thứ trong gói Channel Manager": "Everything in Channel Manager",
  "Trợ lý AI vận hành": "AI operations assistant",
  "Thành viên và phân quyền theo phạm vi": "Members and scoped permissions",
  "Theo dõi người tạo đặt phòng": "Booking creator tracking",
  "Dọn phòng và số liệu tổng quan": "Housekeeping and the metrics overview",

  "{ten} · còn {n} ngày": "{ten} · {n} days left",
  "{ten} · đã hết hạn": "{ten} · expired",

  "Sai quá nhiều lần. Thử lại sau {n} phút.":
    "Too many failed attempts. Try again in {n} minutes.",

  /* ---- Buying a month of a plan ---- */
  "Mua 1 tháng · {gia}": "Buy one month · {gia}",
  "Mua 1 tháng gói {ten}": "One month of {ten}",
  "Đang mở đơn…": "Opening…",
  ". Mỗi lần mua là một tháng, không tự động gia hạn.":
    ". Each purchase is one month, and nothing renews on its own.",
  "← Về gói dịch vụ": "← Back to plans",
  "Quét mã bằng app ngân hàng, hoặc chuyển khoản thủ công theo thông tin bên dưới. Nội dung chuyển khoản phải đúng — đó là thứ khớp giao dịch của bạn với đơn này.":
    "Scan the code in your banking app, or transfer manually using the details below. The transfer reference has to be exact — it is what matches your payment to this purchase.",
  "VietQR · quét bằng app ngân hàng": "VietQR · scan in your banking app",
  "Ngân hàng": "Bank",
  "Số tài khoản": "Account number",
  "Chủ tài khoản": "Account name",
  "Số tiền": "Amount",
  "Nội dung chuyển khoản": "Transfer reference",
  "Chép": "Copy",
  "Đã chép": "Copied",
  "Chuyển xong, gói được mở sau khi chúng tôi đối chiếu sao kê — thường trong vài giờ làm việc. Trang này không tự cập nhật; bạn sẽ thấy gói mới ở màn hình Gói dịch vụ.":
    "Once you have transferred, the plan opens after we match it against the bank statement — usually within a few working hours. This page does not update itself; the new plan appears on the Plans screen.",
  "Đã nhận thanh toán.": "Payment received.",
  "Đã nhận thanh toán. Gói chạy tới {ngay}.": "Payment received. The plan runs until {ngay}.",
  "Đơn này đã hủy. Tạo đơn mới nếu bạn vẫn muốn mua.":
    "This purchase was cancelled. Start a new one if you still want to buy.",
  "Chưa cấu hình tài khoản nhận tiền, nên chưa hiện được mã QR. Đơn đã ghi nhận — liên hệ chúng tôi để thanh toán.":
    "No receiving account is configured, so there is no QR code to show. The purchase is recorded — contact us to pay.",
  "PayPal không nhận {tien}, nên khách sẽ không trả được bằng cổng này. Dùng Stripe, hoặc đổi tiền tệ của cơ sở.":
    "PayPal does not accept {tien}, so guests cannot pay through it. Use Stripe, or change the property's currency.",
  "Giá mỗi đêm ({tien})": "Price per night ({tien})",
  "Tổng tiền ({tien})": "Total ({tien})",
  "Bạn vẫn giữ phòng — có thể trả khi nhận phòng.":
    "Your room is still held — you can pay on arrival.",
  "Bạn đã thoát khỏi trang thanh toán. Phòng vẫn được giữ — trả sau cũng được.":
    "You left the payment page. The room is still held — paying later is fine.",
  "Bỏ chọn phòng này": "Deselect this room",
  "Chưa thanh toán trực tuyến được cho lượt đặt này.":
    "This booking cannot be paid online.",
  "Chưa xác nhận được thanh toán. Phòng vẫn là của bạn — chủ nhà sẽ liên hệ để thu xếp.":
    "We could not confirm the payment. The room is still yours — the host will be in touch to sort it out.",
  "Chọn phòng này": "Choose this room",
  "Chỗ nghỉ này nhận thanh toán khi bạn tới. Chủ nhà sẽ liên hệ để sắp xếp phần còn lại.":
    "This place takes payment on arrival. The host will be in touch to arrange the rest.",
  "Công ty": "Company",
  "Ghi chú cho chủ nhà": "Note for the host",
  "Không còn phòng trống": "No rooms available",
  "Không tìm thấy": "Not found",
  "Lượt đặt này chưa có số tiền để thanh toán.":
    "This booking has no amount to pay.",
  "Lượt đặt này đã thanh toán rồi.": "This booking has already been paid.",
  "Lượt đặt này đã thanh toán. Hẹn gặp bạn.":
    "This booking is paid. See you soon.",
  "Ngày": "Dates",
  "Nhập số điện thoại để chủ nhà liên hệ.":
    "Enter a phone number so the host can reach you.",
  "Nhập tên của bạn.": "Enter your name.",
  "Những đêm bạn chọn đã khoá lại ngay trên lịch của chủ nhà — và trên mọi kênh khác. Chủ nhà sẽ liên hệ để sắp xếp phần còn lại.":
    "The nights you picked are now blocked on the host's calendar — and on every other channel. The host will be in touch to arrange the rest.",
  "Những đêm này đã kín. Thử đổi ngày ở trên — hoặc nhắn trực tiếp cho chủ nhà, có thể còn cách khác.":
    "These nights are full. Try different dates above — or message the host directly, there may be another way.",
  "Phòng của bạn đã được giữ.": "Your room is held.",
  "Phòng này nhận tối đa {n} khách.": "This room takes at most {n} guests.",
  "Rất tiếc, những đêm này vừa có người đặt. Thử chọn ngày khác giúp mình nhé.":
    "Sorry — someone just booked these nights. Please try different dates.",
  "Thanh toán qua {cong}": "Pay with {cong}",
  "Trả trước hay trả khi nhận phòng đều được — phòng đã là của bạn. Tiền vào thẳng tài khoản của chủ nhà.":
    "Pay now or on arrival, either is fine — the room is already yours. The money goes straight to the host's account.",
  "Tối đa {n} khách": "Up to {n} guests",
  "Tổng cộng": "Total",
  "Về {ten}": "Back to {ten}",
  "Xem phòng trống": "Show available rooms",
  "Yêu cầu không hợp lệ.": "That request was not valid.",
  "mỗi đêm": "per night",
  "thẻ": "card",
  "trang chỗ nghỉ": "the property page",
  "{n} phòng còn trống": "{n} rooms available",
  "Đang gửi…": "Sending…",
  "Đang mở trang thanh toán…": "Opening the payment page…",
  "Đang xem {tu} – {den}": "Showing {tu} – {den}",
  "Đã giữ phòng": "Room held",
  "Đã nhận thanh toán. Cảm ơn bạn.": "Payment received. Thank you.",
  "Đã nhận đặt phòng": "Booking received",
  "Đã xác nhận": "Confirmed",
  "Đặt phòng trực tiếp tại {ten}{diachi}.": "Book directly at {ten}{diachi}.",
  "Đặt trực tiếp với chủ nhà. Không phí nền tảng, không hoa hồng — số tiền bạn trả là số tiền chủ nhà nhận.":
    "Book directly with the host. No platform fee, no commission — what you pay is what the host receives.",
  "Đặt trực tiếp · không qua trung gian": "Book direct · no middleman",
  "Đặt tối đa {n} đêm một lần.": "You can book at most {n} nights at once.",
  "Không giải mã được khoá Stripe đã lưu.":
    "The stored Stripe key could not be decrypted.",
  "Không giải mã được khoá Stripe.": "The Stripe key could not be decrypted.",
  "Không giải mã được khoá đã lưu.": "The stored key could not be decrypted.",
  "Không kết nối được tới Stripe.": "Could not reach Stripe.",
  "Không kết nối được tới PayPal.": "Could not reach PayPal.",
  "Không xác thực được với PayPal. Kiểm tra lại khoá.":
    "Could not authenticate with PayPal. Check the keys.",
  "Không xác thực được với PayPal.": "Could not authenticate with PayPal.",
  "PayPal từ chối cặp khoá này.": "PayPal rejected this key pair.",
  "PayPal không nhận tiền tệ này. Đổi tiền tệ của cơ sở, hoặc dùng Stripe.":
    "PayPal does not accept this currency. Change the property's currency, or use Stripe.",
  "Stripe trả về {ma}.": "Stripe returned {ma}.",
  "PayPal trả về {ma}.": "PayPal returned {ma}.",
  "Stripe từ chối khoá này ({ma}).": "Stripe rejected this key ({ma}).",
  "Giá trên là quy đổi để bạn dễ hình dung. Khoản thực thu là {tien}, theo tỷ giá {ty} ₫ = 1 $.":
    "The prices above are converted so they are easier to read. You will actually be charged in {tien}, at {ty} ₫ = 1 $.",
  "khoảng {gia}": "about {gia}",
  "Gửi": "Send",
  "Sẵn sàng": "Ready",
  "Chưa hoạt động": "Not running",
  "Xoá cuộc trò chuyện": "Clear the conversation",
  "Đóng trợ lý": "Close the assistant",
  "Nâng cấp để mở khoá trợ lý": "Upgrade to unlock the assistant",
  "Trợ lý soạn sẵn thay đổi cho bạn duyệt. Gói hiện tại chưa có tính năng này.":
    "The assistant drafts changes for you to approve. Your current plan does not include it.",
  "Xem các gói": "See the plans",
  "Nhờ chủ tài khoản nâng gói.": "Ask the account owner to upgrade.",
  "Máy chủ chưa đặt ANTHROPIC_API_KEY nên trợ lý chưa chạy. Những đề xuất đã có vẫn duyệt được bình thường.":
    "The server has no ANTHROPIC_API_KEY, so the assistant is not running. Existing proposals can still be approved as usual.",
  "Mô tả việc bạn cần bằng lời thường ngày.":
    "Describe what you need in ordinary words.",
  "Ví dụ: khoá Garden Suite từ 5 đến 8 tháng 12 để sơn lại phòng tắm.":
    "For example: block Garden Suite from 5 to 8 December to repaint the bathroom.",
  "Bỏ qua": "Dismiss",
  "Nhắn cho trợ lý": "Message the assistant",
  "Trợ lý chỉ soạn sẵn — không có gì được ghi vào lịch trước khi bạn bấm Duyệt.":
    "The assistant only drafts — nothing reaches the calendar until you press Approve.",
  "Xem tất cả đề xuất": "See every proposal",
  "Chỉ chủ nhà mới đổi được gói.": "Only an owner can change the plan.",
  "Gói này không mua được.": "That plan is not for sale.",
  "Gói hiện tại đang không có hạn kết thúc, mua thêm một tháng sẽ rút ngắn lại. Liên hệ chúng tôi thay vì mua ở đây.":
    "Your current plan has no end date, so buying a month would shorten it rather than extend it. Contact us instead of buying here.",

  /* ---- Deleting a property ---- */
  "Xóa cơ sở": "Delete this property",
  "Xóa cơ sở này": "Delete this property…",
  "Xóa vĩnh viễn": "Delete permanently",
  "Đang xóa…": "Deleting…",
  "Cơ sở, các phòng bên trong và toàn bộ lượt đặt của chúng sẽ mất. Không có thùng rác và không khôi phục được.":
    "The property, the rooms inside it and every booking they hold all go. There is no bin and no undo.",
  "Xóa xong không lấy lại được. Những thứ sau đây mất cùng cơ sở:":
    "This cannot be undone. These go with the property:",
  "{n} lượt đặt": "{n} bookings",
  "— trong đó {n} lượt chưa trả phòng": "— {n} of them have not checked out",
  "Có khách đang ở hoặc sắp đến. Báo cho họ trước khi xóa — lịch của bạn sẽ không còn chỗ nào để nhắc bạn về họ.":
    "Someone is staying or about to arrive. Tell them before you delete this — afterwards your calendar has nowhere left to remind you about them.",
  "Gõ “{ten}” để xác nhận": "Type “{ten}” to confirm",
  "Tên chưa khớp. Gõ đúng tên cơ sở để xác nhận.":
    "That name does not match. Type the property's name exactly to confirm.",
  "Không tìm thấy cơ sở này.": "That property could not be found.",
  "Chỉ chủ nhà mới xóa được cơ sở.": "Only an owner can delete a property.",

  /* ---- Finding a booking from the calendar toolbar ---- */
  "Tìm khách hoặc mã đặt": "Find a guest or booking code",
  "{n} kết quả cho “{tim}”": "{n} results for “{tim}”",
  "Xóa tìm kiếm": "Clear the search",
  "Không tìm thấy lượt đặt nào. Thử tên khách, số điện thoại, hoặc vài ký tự cuối của mã đặt.":
    "No bookings found. Try the guest's name, their phone number, or the last few characters of the booking code.",
};
