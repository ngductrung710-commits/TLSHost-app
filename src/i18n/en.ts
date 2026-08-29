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
  "Một tài khoản, một cơ sở. Thêm chỗ nghỉ và mời người sau.":
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
  "Bảng này dựng từ danh sách phòng. Thêm chỗ nghỉ rồi quay lại.":
    "This board is built from your rooms. Add a property and come back.",
  "Thêm chỗ nghỉ đầu tiên và các phòng của nó. Lịch, buồng phòng và trang đặt phòng đều dựng lên từ đó.":
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
  "Thêm chỗ nghỉ": "Add a property",
  "Chưa có chỗ nghỉ nào": "No properties yet",
  "Chưa có phòng nào": "No rooms yet",
  "Chưa có cơ sở nào": "No business yet",
  "Tạo chỗ nghỉ": "Create property",
  "Tên chỗ nghỉ": "Property name",
  "Đặt tên cho chỗ nghỉ.": "Give the property a name.",
  "Tên bạn dùng để gọi chỗ nghỉ của mình. Đổi được sau.":
    "What you call this place yourself. You can change it later.",
  "An Bàng Villa": "An Bang Villa",
  "Địa chỉ": "Address",
  "Hội An, Đà Nẵng": "Hoi An, Da Nang",
  "(không bắt buộc)": "(optional)",
  "Phòng và giá": "Rooms and rates",
  "Cần ít nhất một phòng — mỗi dòng một phòng.":
    "At least one room is needed — one per line.",
  "Mỗi dòng một phòng. Nếu cho thuê nguyên căn, viết một dòng duy nhất — cả căn villa là một phòng.":
    "One room per line. If you rent the whole place, write a single line — the entire villa is one room.",
  "Phòng là thứ nhận đặt. Liệt kê đủ phòng ở đây thì lịch sẽ có đủ hàng.":
    "Rooms are what take bookings. List them all here and the calendar has a row for each.",
  "Có tên phòng bị trùng. Mỗi phòng cần một tên riêng.":
    "Two rooms have the same name. Each room needs its own.",
  "Giá mỗi đêm (₫)": "Rate per night (₫)",
  "Giá mỗi đêm hiển thị trên trang đặt phòng. Phòng chưa có giá vẫn nhận được đặt, chỉ là khách không thấy con số nào.":
    "The nightly rate shown on the booking page. A room with no rate still takes bookings, the guest just sees no figure.",
  "bỏ giá": "clear the rate",
  "Thêm chỗ nghỉ đầu tiên và liệt kê các phòng bên trong. Lịch sẽ dựng lên từ đó.":
    "Add your first property and list the rooms inside it. The calendar is built from them.",
  "Chỉ chủ nhà mới thêm được chỗ nghỉ.": "Only the host can add properties.",

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
  "Cơ sở": "Business",
  "Tên cơ sở": "Business name",
  "Tên cơ sở không được để trống.": "The business name cannot be empty.",
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
  "Không giới hạn chỗ nghỉ": "Unlimited properties",
  "Đồng bộ kênh OTA": "OTA channel sync",
  "Trợ lý AI": "AI assistant",
  "Đội ngũ & phân quyền": "Team and permissions",
  "Chưa có đồng bộ kênh": "No channel sync",
  "Chưa có trợ lý AI": "No AI assistant",
  "Chưa có đội ngũ": "No team",

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
  "{n} chỗ nghỉ": "{n} properties",
  ". Chưa có thanh toán trong ứng dụng — nhắn cho chúng tôi để đổi gói.":
    ". There is no in-app payment yet — message us to change plan.",
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
  "Khởi đầu": "Free",
  "Chuyên nghiệp": "Professional",
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
  "Bảng lịch cần ít nhất một phòng để có gì mà hiển thị. Thêm chỗ nghỉ đầu tiên rồi quay lại đây.":
    "The calendar needs at least one room before it has anything to show. Add your first property and come back.",
  "Danh sách đặt phòng trong khoảng đang xem":
    "Bookings in the range currently shown",
  "Nhận phòng": "Check-in",
  "Tên khách": "Guest name",
  "Điện thoại": "Phone",
  "Số khách": "Guests",
  "Tổng tiền (₫)": "Total (₫)",
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
};
