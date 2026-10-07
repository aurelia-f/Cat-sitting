public class Student {
    private String name;
    private int studentId;

    public Student (String name, int studentId){
        this.name=name;
        this.studentId=studentId;
    }


    public class AcademicRecord{
        private String module;
        private int mark;

        public AcademicRecord (String module, int mark){
            if (mark < 0 || mark > 100) {
                throw new IllegalArgumentException("The grade must be between 0 and 100");
            }
            this.module= module;
            this.mark=mark;
        }

        public void displayRecord(){
            System.out.println(name+"'s grade is: "+ mark+" for "+module+"'s module. ");
        }
    }
}
